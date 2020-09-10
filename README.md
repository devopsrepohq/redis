Use this CDK stack to create a redis cluster and allow bastion host to access it.

![Redis architecture](https://images.prismic.io/devopsrepo/fd205ac2-9746-406c-ad24-1a744352272e_redis.png?auto=compress,format)

## What is it?

Amazon ElastiCache allows you to seamlessly set up, run, and scale popular open-Source compatible in-memory data stores in the cloud.

## Features

- [x] Deploy a redis clusters
- [x] Setup to allow bastion host to access it

## Prerequisites

You will need the following before utilize this CDK stack:

- [AWS CLI](https://cdkworkshop.com/15-prerequisites/100-awscli.html)
- [AWS Account and User](https://cdkworkshop.com/15-prerequisites/200-account.html)
- [Node.js](https://cdkworkshop.com/15-prerequisites/300-nodejs.html)
- [IDE for your programming language](https://cdkworkshop.com/15-prerequisites/400-ide.html)
- [AWS CDK Tookit](https://cdkworkshop.com/15-prerequisites/500-toolkit.html)
- [AWS Toolkit VSCode Extension](https://github.com/devopsrepohq/aws-toolkit)

## Stack Explain

### cdk.json

Define project-name, env and profile context variables in cdk.json

```json
{
  "context": {
    "project-name": "container",
    "env": "dev",
    "profile": "devopsrepo"
  }
}
```

### lib/vpc-stack.ts

Setup standard VPC with public, private, and isolated subnets.

```javascript
const vpc = new ec2.Vpc(this, 'Vpc', {
  maxAzs: 3,
  natGateways: 1,
  cidr: '10.0.0.0/16',
  subnetConfiguration: [
    {
      cidrMask: 24,
      name: 'ingress',
      subnetType: ec2.SubnetType.PUBLIC,
    },
    {
      cidrMask: 24,
      name: 'application',
      subnetType: ec2.SubnetType.PRIVATE,
    },
    {
      cidrMask: 28,
      name: 'rds',
      subnetType: ec2.SubnetType.ISOLATED,
    }
  ]
});
```

- maxAzs - Define 3 AZs to use in this region.
- natGateways - Create only 1 NAT Gateways/Instances.
- cidr - Use '10.0.0.0/16' CIDR range for the VPC.
- subnetConfiguration - Build the public, private, and isolated subnet for each AZ.

Create flowlog and log the vpc traffic into cloudwatch

```javascript
vpc.addFlowLog('FlowLog');
```

### lib/security-stack.ts

Get vpc create from vpc stack

```javascript
const { vpc } = props;
```

Create security group for bastion host

```javascript
const bastionSecurityGroup = new ec2.SecurityGroup(this, 'BastionSecurityGroup', {
  vpc: vpc,
  allowAllOutbound: true,
  description: 'Security group for bastion host',
  securityGroupName: 'BastionSecurityGroup'
});
```

- vpc - Use vpc created from vpc stack.
- allowAllOutbound - Allow outbound rules for access internet
- description - Description for security group
- securityGroupName - Define the security group name

Allow ssh access to bastion host

```javascript
bastionSecurityGroup.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(22), 'SSH access');
```

Create security group for redis

```javascript
const redisSecurityGroup = new ec2.SecurityGroup(this, 'RedisSecurityGroup', {
  vpc: vpc,
  allowAllOutbound: true,
  description: 'Security group for Redis Cluster',
  securityGroupName: 'RedisSecurityGroup'
});
```

Allow access from bastion host

```javascript
redisSecurityGroup.addIngressRule(bastionSecurityGroup, ec2.Port.tcp(6379), 'Access from bastion host');
```

### lib/bastion-stack.ts

Get the vpc and bastionSecurityGroup from vpc and security stacks.

```javascript
const { vpc, bastionSecurityGroup } = props;
```

Get profile from context variables

```javascript
const profile = this.node.tryGetContext('profile');
```

Create bastion host instance in public subnet

```javascript
const bastionHostLinux = new ec2.BastionHostLinux(this, 'BastionHostLinux', {  
  vpc: vpc,
  securityGroup: bastionSecurityGroup,
  subnetSelection: {
    subnetType: ec2.SubnetType.PUBLIC
  }
});
```

- vpc - Use vpc created from vpc stack.
- securityGroup - Use security group created from security stack.
- subnetSelection - Create the instance in public subnet.

Display commands for connect bastion host using ec2 instance connect

```javascript
const createSshKeyCommand = 'ssh-keygen -t rsa -f my_rsa_key';
const pushSshKeyCommand = `aws ec2-instance-connect send-ssh-public-key --region ${cdk.Aws.REGION} --instance-id ${bastionHostLinux.instanceId} --availability-zone ${bastionHostLinux.instanceAvailabilityZone} --instance-os-user ec2-user --ssh-public-key file://my_rsa_key.pub ${profile ? `--profile ${profile}` : ''}`;
const sshCommand = `ssh -o "IdentitiesOnly=yes" -i my_rsa_key ec2-user@${bastionHostLinux.instancePublicDnsName}`;
        
new cdk.CfnOutput(this, 'CreateSshKeyCommand', { value: createSshKeyCommand });
new cdk.CfnOutput(this, 'PushSshKeyCommand', { value: pushSshKeyCommand });
new cdk.CfnOutput(this, 'SshCommand', { value: sshCommand});
```

### lib/redis-stack.ts

Get the vpc and redisSecurityGroup from vpc and security stack

```javascript
const { vpc, redisSecurityGroup } = props;
```

Get projectName and env from context variables

```javascript
const projectName = this.node.tryGetContext('project-name');
const env = this.node.tryGetContext('env');
```

Get all private subnet ids

```javascript
const privateSubnets = vpc.privateSubnets.map((subnet) => {
  return subnet.subnetId
});
```

Create redis subnet group from private subnet ids

```javascript
const redisSubnetGroup = new redis.CfnSubnetGroup(this, 'RedisSubnetGroup', {
  subnetIds: privateSubnets,
  description: "Subnet group for redis"
});
```

- subnetIds - Assign the subnet ids to redis subnet group
- description - Define the description for redis subnet group

Create Redis Cluster

```javascript
const redisCluster = new redis.CfnCacheCluster(this, 'RedisCluster', {
  autoMinorVersionUpgrade: true,
  cacheNodeType: 'cache.t2.small',
  engine: 'redis',
  numCacheNodes: 1,
  cacheSubnetGroupName: redisSubnetGroup.ref,
  clusterName: `${projectName}${env}`,
  vpcSecurityGroupIds: [redisSecurityGroup.securityGroupId]
});
```

- autoMinorVersionUpgrade - Allow auto upgrade for minor version.
- cacheNodeType - Use 'cache.t2.small' for node type.
- engine: Use redis.
- numCacheNodes: Use 1 cache node.
- cacheSubnetGroupName: Use redisSubnetGroup for cacheSubnetGroupName.
- clusterName: Define the clusterName using project and env name pattern.
- vpcSecurityGroupIds: Define the array for security group ids.

Define this redis cluster is depends on redis subnet group created first

```javascript
redisCluster.addDependsOn(redisSubnetGroup);
```

Deploy all the stacks to your aws account.

```bash
cdk deploy '*'
or
cdk deploy '*' --profile your_profile_name
```

## Useful commands

### NPM commands

 * `npm run build`   compile typescript to js
 * `npm run watch`   watch for changes and compile
 * `npm run test`    perform the jest unit tests

### Toolkit commands

 * `cdk list (ls)`            Lists the stacks in the app
 * `cdk synthesize (synth)`   Synthesizes and prints the CloudFormation template for the specified stack(s)
 * `cdk bootstrap`            Deploys the CDK Toolkit stack, required to deploy stacks containing assets
 * `cdk deploy`               Deploys the specified stack(s)
 * `cdk deploy '*'`           Deploys all stacks at once
 * `cdk destroy`              Destroys the specified stack(s)
 * `cdk destroy '*'`          Destroys all stacks at once
 * `cdk diff`                 Compares the specified stack with the deployed stack or a local CloudFormation template
 * `cdk metadata`             Displays metadata about the specified stack
 * `cdk init`                 Creates a new CDK project in the current directory from a specified template
 * `cdk context`              Manages cached context values
 * `cdk docs (doc)`           Opens the CDK API reference in your browser
 * `cdk doctor`               Checks your CDK project for potential problems

## Pricing

As this cdk stack will create aws elasticache service, please refer the following link for pricing

- [Amazon ElastiCache pricing](https://aws.amazon.com/elasticache/pricing/?nc=sn&loc=5)
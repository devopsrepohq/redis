import * as cdk from '@aws-cdk/core';
import * as redis from '@aws-cdk/aws-elasticache';

import { IVpc } from '@aws-cdk/aws-ec2';

interface RedisStackProps extends cdk.StackProps {
  vpc: IVpc;
  redisSecurityGroup: string;
}

export class RedisStack extends cdk.Stack {
  constructor(scope: cdk.Construct, id: string, props: RedisStackProps) {
    super(scope, id, props);
   
    // Get the vpc and redisSecurityGroup from vpc and security stack
    const { vpc, redisSecurityGroup } = props;

    // Get projectName and env from context variables
    const projectName = this.node.tryGetContext('project-name');
    const env = this.node.tryGetContext('env');

    // Get all private subnet ids
    const privateSubnets = vpc.privateSubnets.map((subnet) => {
      return subnet.subnetId
    })

    // Create redis subnet group from private subnet ids
    const redisSubnetGroup = new redis.CfnSubnetGroup(this, 'RedisSubnetGroup', {
      subnetIds: privateSubnets,
      description: "Subnet group for redis"
    })

    // Create Redis Cluster
    const redisCluster = new redis.CfnCacheCluster(this, 'RedisCluster', {
      autoMinorVersionUpgrade: true,
      cacheNodeType: 'cache.t2.small',
      engine: 'redis',
      numCacheNodes: 1,
      cacheSubnetGroupName: redisSubnetGroup.ref,
      clusterName: `${projectName}-redis-${env}`,      
      vpcSecurityGroupIds: [redisSecurityGroup]
    })
    
    // Define this redis cluster is depends on redis subnet group created first
    redisCluster.addDependsOn(redisSubnetGroup)
  }
}

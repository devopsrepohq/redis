import * as cdk from '@aws-cdk/core';
import * as ec2 from '@aws-cdk/aws-ec2';

import { ISecurityGroup, IVpc } from '@aws-cdk/aws-ec2';

interface SecurityStackProps extends cdk.StackProps {
  vpc: IVpc;
}

export class SecurityStack extends cdk.Stack {
  public readonly redisSecurityGroup: ISecurityGroup;

  constructor(scope: cdk.Construct, id: string, props: SecurityStackProps) {
    super(scope, id, props);

    // Get the vpc from vpc stack
    const { vpc } = props;

    // Create security group for redis
    const redisSecurityGroup = new ec2.SecurityGroup(this, 'RedisSecurityGroup', {
      vpc: vpc,
      allowAllOutbound: true,
      description: 'Security group for Redis Cluster',
      securityGroupName: 'redis-security-group'
    });

    // Allow ssh access to redis cluster
    redisSecurityGroup.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(22), 'SSH access');

    // Assign the redisSecurityGroup to class property
    this.redisSecurityGroup = redisSecurityGroup;
  }
}

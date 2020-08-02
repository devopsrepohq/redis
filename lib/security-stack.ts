import * as cdk from '@aws-cdk/core';
import * as ec2 from '@aws-cdk/aws-ec2';

import { IVpc } from '@aws-cdk/aws-ec2';

interface SecurityStackProps extends cdk.StackProps {
  vpc: IVpc;
}

export class SecurityStack extends cdk.Stack {
  constructor(scope: cdk.Construct, id: string, props: SecurityStackProps) {
    super(scope, id, props);

    // Get the vpc from vpc stack
    const { vpc } = props;

    // Create security group for bastion host
    const bastionSecurityGroup = new ec2.SecurityGroup(this, 'BastionSecurityGroup', {
      vpc: vpc,
      allowAllOutbound: true,
      description: 'Security group for bastion host',
      securityGroupName: 'BastionSecurityGroup'
    });

    // Allow ssh access to bastion host
    bastionSecurityGroup.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(22), 'SSH access');

    // Create security group for redis
    const redisSecurityGroup = new ec2.SecurityGroup(this, 'RedisSecurityGroup', {
      vpc: vpc,
      allowAllOutbound: true,
      description: 'Security group for Redis Cluster',
      securityGroupName: 'RedisSecurityGroup'
    });

    // Allow access from bastion host
    redisSecurityGroup.addIngressRule(bastionSecurityGroup, ec2.Port.tcp(6379), 'Access from bastion host');

    // Export redis security group id
    new cdk.CfnOutput(this, 'RedisSecurityGroupExport', {
      value: redisSecurityGroup.securityGroupId,
      exportName: 'RedisSecurityGroupExport'
    });
  }
}
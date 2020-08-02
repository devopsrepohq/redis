#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from '@aws-cdk/core';
import { RedisStack } from '../lib/redis-stack';

const app = new cdk.App();
new RedisStack(app, 'RedisStack');

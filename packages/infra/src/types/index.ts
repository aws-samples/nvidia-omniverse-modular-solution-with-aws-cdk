// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

import { RemovalPolicy, StackProps } from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import { StackConfigurator } from '../main';

/**
 * Collections
 */
interface ICollection {
    [key: string]: any;
}

export interface SubnetCollection extends ICollection {
    public: ec2.ISubnet[];
    workstation?: ec2.ISubnet[];
    loadBalancer?: ec2.ISubnet[];
    reverseProxy?: ec2.ISubnet[];
    nucleus?: ec2.ISubnet[];
}

export interface SubnetConfigurationCollection extends ICollection {
    public: ec2.SubnetConfiguration;
    workstation?: ec2.SubnetConfiguration;
    loadBalancer?: ec2.SubnetConfiguration;
    reverseProxy?: ec2.SubnetConfiguration;
    nucleus?: ec2.SubnetConfiguration;
}

export interface NaclCollection extends ICollection {
    public: ec2.NetworkAcl;
    workstation: ec2.NetworkAcl;
    loadBalancer?: ec2.NetworkAcl;
    reverseProxy?: ec2.NetworkAcl;
    nucleus?: ec2.NetworkAcl;
}

export interface SecurityGroupCollection extends ICollection {
    natGateway: ec2.SecurityGroup;
    vpcEndpoint: ec2.SecurityGroup;
    jumpbox?: ec2.SecurityGroup;
    workstation?: ec2.SecurityGroup;
    loadBalancer?: ec2.SecurityGroup;
    reverseProxy?: ec2.SecurityGroup;
    nucleus?: ec2.SecurityGroup;
}

/**
 * Props
 */
export interface BaseStackProps extends StackProps {
    configurator: StackConfigurator;
    removalPolicy: RemovalPolicy;
    autoDelete: boolean;
}
import * as ec2 from 'aws-cdk-lib/aws-ec2';

export interface VpcResources {
    vpc: ec2.Vpc,
    subnets: ec2.ISubnet[],
}

export interface SubnetCollection {
    public: ec2.ISubnet[];
    workstation: ec2.ISubnet[];
    loadBalancer?: ec2.ISubnet[];
    reverseProxy?: ec2.ISubnet[];
    nucleus?: ec2.ISubnet[];
}

export interface NaclCollection {
    public: ec2.NetworkAcl;
    workstation: ec2.NetworkAcl;
    loadBalancer?: ec2.NetworkAcl;
    reverseProxy?: ec2.NetworkAcl;
    nucleus?: ec2.NetworkAcl;
}

export interface SecurityGroupCollection {
    jumpbox: ec2.SecurityGroup;
    workstation: ec2.SecurityGroup;
    vpcEndpoint: ec2.SecurityGroup;
    natGatway: ec2.SecurityGroup;
    loadBalancer?: ec2.SecurityGroup;
    reverseProxy?: ec2.SecurityGroup;
    nucleus?: ec2.SecurityGroup;
}
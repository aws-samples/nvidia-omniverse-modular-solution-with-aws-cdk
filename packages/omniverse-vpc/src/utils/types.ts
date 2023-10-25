import * as ec2 from 'aws-cdk-lib/aws-ec2';

export enum ProjectType {
    WORKSTATION = "workstation",
    NUCLEUS = "nucleus",
    CACHE = "cache",
    FARM = "farm",
}
export interface VpcResources {
    vpc: ec2.Vpc,
    subnets: ec2.ISubnet[],
}

export interface SubnetCollection {
    public: ec2.ISubnet[];
    workstation: ec2.ISubnet[];
    loadBalancer: ec2.ISubnet[];
    reverseProxy: ec2.ISubnet[];
    nucleus: ec2.ISubnet[];
}

export interface SecurityGroupCollection {
    loadBalancer: ec2.SecurityGroup;
    jumpbox: ec2.SecurityGroup;
    workstation: ec2.SecurityGroup;
    reverseProxy: ec2.SecurityGroup;
    nucleus: ec2.SecurityGroup;
    vpcEndpoint: ec2.SecurityGroup;
}
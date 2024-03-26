# NVIDIA Omniverse Nucleus deployment guide

A guide to deploy NVIDIA Omniverse Enterprise Nucleus on Amazon EC2. Last updated on 03/2024.

## Overview

This guide includes steps to deploy a NVIDIA Omniverse Enterprise Nucleus on Amazon EC2. This module can be deployed individually or alongside the Workstation module.

## Contents
- [Step 1 - Prerequisites]
- [Step 2 - Project Configuration]
- [Step 2 - AWS CDK Configuration]


* [Architecture](#architecture)
* [Prerequisites](#prerequisites)
* [Project Configuration](#project-configuration)
* [Deployment Instructions](#deployment-instructions)
* [Teardown](#teardown)
* [Troubleshooting](#troubleshooting)
* [Getting Help](#getting-help)
* [Changelog](#changelog)
* [Security](#security)
* [License](#license)
* [References](#references)


## Architecture
<img src="./media/image1.jpeg>

The above reference architecture combines NVIDIA Omniverse Workstations and Nucleus within a single Region and across two Availability Zones (AZs). Workstation connectivity is through an endpoint outside of AWS and leverages the NICE DCV Viewer client application. Nucleus connectivity is configured with the Workstations and routes through a Route 53 Private Hosted Zone. Each compute asset grouping is configured with separate Security Groups to allow for specific traffic routing.

> NOTE: The VPC, Public Subnets, NAT Gateways, public NACLs, and public route tables are repeated in the diagram to help explain the routing and connectivity.


## Prerequisites
- AWS CLI - https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html
- AWS CDK - https://docs.aws.amazon.com/cdk/v2/guide/getting_started.html#getting_started_install
- Docker - https://www.docker.com/products/docker-desktop/
- Python 3.9 or greater - https://www.python.org
- Access to NVIDIA Enterprise Omniverse Nucleus packages - https://docs.omniverse.nvidia.com/prod_nucleus/prod_nucleus/enterprise/installation/quick_start_tips.html
- NICE DCV Client - https://download.nice-dcv.com/latest.html 

**To learn more, reference the official documentation from NVIDIA:** https://docs.omniverse.nvidia.com/prod_nucleus/prod_nucleus/enterprise/cloud_aws_ec2.html


## Project Configuration
### 1. Download Nucleus Deployment Artifacts from NVIDIA
Download the Omniverse Enterprise Nucleus artifacts from NVIDIA and place them in `./shared/src/tools/nucleusServer/stack`

For example: `./shared/src/tools/nucleusServer/stack/nucleus-stack-2023.1.0+tag-2023.1.0.gitlab.8633670.7f07353a.tar.gz`

Consult NVIDIA documentation to find the appropriate packages.

> Note This deployment has a templated copy of `nucleus-stack.env` located at `./shared/src/tools/nucleusServer/templates/nucleus-stack.env` this may need to be updated if NVIDIA makes changes to the `nucleus-stack.env` file packaged with their archive.
>
> The same applies to NVIDIA's reverse proxy `nginx.conf` located at `./shared/src/tools/reverseProxy/templates/nginx.conf`

### 2. AWS CDK Configuration
In `./config` create a file named `infra.config.json`. This file is used to configure the Stacks on deployment. See the below template for the expected schema.
```
{
	"name": "Omni",
	"env": {
		"account": "AWS_ACCOUNT",
		"region": "AWS_REGION"
	},
	"stacks": {
		"infra": {
			"name": "InfraStack",
			"artifactsBucketName": "ARTIFACTS_BUCKET_NAME",
			"rootDomain": "ROOT_DOMAIN",
			"nucleusServerPrefix": "DOMAIN_PREFIX",
			"nucleusBuild": "nucleus-stack-2023.1.0+tag-2023.1.0.gitlab.8633670.7f07353a",
			"allowedRanges": ["ALLOWED_CIDR_1", "ALLOWED_CIDR_2"],
			"jumpboxInstanceType": "t3.small",
			"ovInstanceType": "g5.4xlarge",
			"removalPolicy": "destroy",
			"autoDelete": true
		},
		"desktop": {
			"name": "WorkstationStack",
			"amiName": "",
			"amiId": "",
			"ovInstanceType": "g5.4xlarge",
			"instanceQuantity": 2,
			"removalPolicy": "destroy",
			"autoDelete": true
		}
	},
	"cdkNag": true
}
```
 #### Property Definitions
 * *account*: the 12 digit AWS account ID of the target account
 * *region*: target AWS region system name (e.g. `us-west-2`, `us-east-1`, etc.)
 * *artifactsBucketName*: name of the S3 Bucket to create and upload the Nucleus artifacts to
 * *rootDomain*: registered domain name used as the root path to the Nucleus server. 
 * *nucleusServerPrefix*: subdomain for the Nucleus server. Nucleus server fully qualified domain will be `nucleusServerPrefix.rootDomain`
 * *nucleusBuild*: Nucleus stack artifacts name. Default: `nucleus-stack-2023.1.0+tag-2023.1.0.gitlab.8633670.7f07353a`
 * *allowedRanges*: IP/Cidr ranges allowed to access Jumpboxes. Cidr mask required (e.g. `127.0.0.1/32`)
 * *jumpboxInstanceType*: EC2 instance type for the Jumpboxes. Default: `t3.small`
 * *ovInstanceType*: EC2 instance type for the Omniverse workstations. Default: `g5.4xlarge`
 * *amiName*: Omniverse workstation Golden Amazon Machine Image (AMI) name
 * *amiId*: Omniverse workstation Golden Amazon Machine Image (AMI) ID
 * *instanceQuantity*: Number of Omniverse workstations to provision
 * *removalPolicy*: The removal policy controls what happens to the resource if it stops being managed by CloudFormation. This can happen in one of three situations: `destroy`, `retain`, or `snapshot`.
 * *autoDelete*: Whether all objects should be automatically deleted when the resource is removed. `true` requires `removalPolicy` to be set to `destroy`.

>NOTE: The `rootDomain` must be registered prior to deployment. The deployment will fail otherwise.

##  Deployment Instructions
This project consists of two Stacks that require separate deployment steps. First, the InfraStack is deployed to provision the VPC resources, Nucleus server and dependencies, and the Omniverse Workstation Base EC2 instance. Second, after the Golden AMI for the Omniverse Workstations is complete, the WorkstationStack is deployed to provision the workstations.

### 1. Project & Account Preparation
First, install the dependency packages for the project. From your CLI run:
```
npm install
```
To prepare your AWS account for the CDK application start by bootstrapping:
```
cdk bootstrap <ACCOUNT_ID>/<AWS_REGION>
```

Once that is complete, synthesize the CDK application to verify the configuration is correct:
```
cdk synth
```

### 2. Deploy the Infrastructure Stack

Now, deploy the InfraStack to create the VPC, networking resources, Nucleus solution, and Omniverse Base instance:
```
cdk deploy Omni-InfraStack
```
If you changed the names of the stacks or application in the `infra.config.json` this step will be in the form of: `cdk deploy <config.name>-<config.stacks.infra.name>`

> NOTE: It can take 15-20 minutes for all resources to be provisioned and in the running state.

### 3. Create the Omniverse Workstation Golden AMI 
This section contains the steps to create the Golden AMI needed for the second CDK stack. The steps include setting up Omniverse Launcher, installing Omniverse USD Composer, changing the default user password, applying instance updates, and creating the Golden AMI.

#### 1. Connect to the Omniverse Workstation Base EC2 instance
Connection to the Omniverse Workstations requires creating an SSH tunnel through one of the Jumpbox instances. After the SSH tunnel has been established a user should use the NICE DCV Client to connect to a workstation.
> NOTE: Ensure that the Jumpbox and Omniverse Workstation IPs are within the same Availability Zone.

To establish the SSH tunnel, download the SSH key from AWS Systems Manager Parameter Store. The Jumpbox SSH key ID can be found in the InfraStack outputs in the CloudFormation Console. The key value can be accessed either from the SSM Console or with the AWS CLI. If using the AWS CLI, run the following command to download the key and save it to the local machine. 
```
aws ssm get-parameter --name "KEY_ID" --with-decryption \
| jq -r .Parameter.Value \
> ~/omniverse-jumpbox-key.pem \
&& chmod 400 ~/omniverse-jumpbox-key.pem
```

For this use case the SSH tunnel maps port `8888` on the workstation to `8443` on the local machine to allow connection with NICE DCV. The IP addresses for this step can either be found in the CloudFormation Stack outputs or the EC2 Console. The SSH tunnel to the Omniverse Workstation can be established by running the below command.
```
ssh -i ~/omniverse-jumpbox-key.pem -L 8888:OMNIVERSE_WORKSTATION_PRIVATE_IP:8443 ec2-user@JUMPBOX_PUBLIC_IP
```

Open the NICE DCV Viewer client application and input `localhost:8888` and click the Connect button to initiate the connection. Next, input the follwing initial credentials:
 * Username: ov-user
 * Password: 0V-user!

#### 2. Setup Omniverse Launcher
If successful, a Microsoft Windows desktop will appear. Open the Omniverse Launcher application and log in using your NVIDIA account credentials. If you do not already have an NVIDIA account, please create one and then log in. 

Scroll to the bottom of the license agreement and select Continue. 

After accepting the above license agreement, leave the default settings as-is and select Continue. You will then be prompted to install Cache. The cache is optional, you may skip this step.

#### 3. Install NVIDIA Omniverse USD Composer (formerly Create)
Now that we've connected to the EC2 instance and have access to our virtual desktop, we will open the Omniverse Launcher and download Omniverse USD Composer. NVIDIA Omniverse USD Composer (formerly Create) allows you to navigate, modify and render Pixar USD content.

Along with USD, Omniverse USD Composer can connect to many applications using Omniverse Connectors to publish 3D models, materials, animation and lighting into USD format. Connectors are available 
for many existing tools like Revit, Sketchup, 3ds Max, Rhino, Grasshopper, Maya, Unreal, Blender and more on the way. When connected to a Nucleus service, content can be authored LIVE between applications and users for advanced multi user collaborative workflows.

When you first login to the NVIDIA Omniverse Launcher, you will be prompted to install a Cache. You may skip this step.
On the NVIDIA Omniverse Launcher, select the Exchange tab. The Exchange provides a selection of Omniverse collections, apps, and content that can be installed.

> NOTE: NVIDIA Omniverse Launcher still names this application Omniverse Create. The launcher will reflect the new name, Omniverse USD Composer, in the near future.

Find and select Create. From the Create information window, select the latest version (as of March 2023, this is v2022.3.3) from the dropdown menu and click Install.

> NOTE: The installation may take around 10-15 minutes.


Once it has finished installing, select Launch to open Omniverse USD Composer to verify the installation.


#### 4. Change the Workstation user default password
While connected to the Omniverse Workstation Base EC2 instance, launch a Windows PowerShell session and run the following command to change the password for the ov-user user. Replace NEW_USER_PASSWORD with a generated password.
```
net user ov-user "[NEW_USER_PASSWORD]"
```
Now disconnect from the instance by closing the NICE DCV Viewer client.

#### 5. Apply system updates
In a web browser, launch the SSM Console and open Fleet Manager located in Node Management. Select the instance containing OVWorkstationBase, click Node Actions > Tools > Patch Nodes. This action will launch the Patch Manager.

Select the "Scan and install" option, select the "Reboot if needed" option, select the "Patch only the target instances I specify" option, select the instance containing OVWorkstationBase, and click "Patch now".

> NOTE: This process can take between 15-30 minutes.

#### 6. Create the Golden AMI
Open the EC2 Console and select the OVWorkstationBase instance. Click Actions > Image and templates > Create image. Enter an Image name, such as OVWorkstationGolden, and click Create image.

> NOTE: Creating the image can take 15-30 minutes.

### 4. Deploy the Workstation Stack
Now that the Golden AMI is configured, copy the AMI ID and AMI Name into the `infra.config.json` file. This will allow for the Golden AMI to be used for the Omniverse Workstations. 

>NOTE: This stack will fail deploying if the target AWS Account and Region do not have sufficient quota for On-Demand EC2 G instances. Verify enough quota has been allocated prior to deployment. To learn more about requesting a service quota increase, please review this documentation: https://docs.aws.amazon.com/servicequotas/latest/userguide/request-quota-increase.html

Now deploy the WorkstationStack to create the Omniverse Workstation fleet:
```
cdk deploy Omni-WorkstationStack
```
> NOTE: It can take 5-10 minutes for this stack to complete

### Establishing Connections
#### 1. Omniverse Workstation
With the InfraStack and Workstation deployed, the Omniverse Workstations should be available. Connect to the Omniverse Workstations using the steps in section 3.1 above. Input the username and password created in section 3.4.

#### 2. Nucleus Server
From the Omniverse Workstation the Nucleus server can been connected and tested. To set up Nucleus, open the Omniverse Launcher application and select the Nucleus tab. Click  the "Connect to Server" button and paste in the full domain used in the `infra.config.json` (e.g. `<NUCLEUS_SERVER_PREFIX>.<ROOT_DOMAIN>`).

The default admin username for the Nucleus server is `omniverse`. You can find the password in a Secrets Manager resource via the AWS Secrets Manager Console. Alternatively, from the Omniverse Nucleus UI, you can create a new username and password.


## Teardown
The teardown process requires a mix of manual and automated steps. Follow the below steps to remove deployed resources from the AWS account.

1. The Nucleus Primary and Nucleus Standby EC2 instances have Termination Protection enabled. Begin by navigating the the EC2 Console and disabling Termination Protection. This option is found under Actions > Instance Settings > Change termination protection. Once the modal pops-up, untick the "Enable" box.

2. Next, navigate to the Route53 Console and select the private hosted zone. In the hosted zone details, delete the `CNAME` and `A` record entries.

3. Once Steps 1 and 2 are complete, the rest of the teardown process can be automated with CloudFormation. Navigate to the CloudFormation Console. Deleting the CloudFormation Stacks is a 2 step process starting with the WorkstationStack. Select the WorkstationStack and select Delete.

4. Once the WorkstationStack has completed deleting, select the InfraStack and select Delete. Since the VPC and Nucleus stacks are nested within the InfraStack, they will be deleted alongside it. When the InfraStack has been deleted the teardown process is complete.


## Troubleshooting
### Unable to connect to the Nucleus Server
If you are not able to connect to to the Nucleus server, review the status of the Nginx service, and the Nucleus docker stack. To do so, connect to your instances from the EC2 Console via Session Manager - https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/session-manager.html.

- On the Nginx Server, run `sudo journalctl -u nginx.service`, if this is produces no output the Nginx service is not running.

- On the Nucleus server, run `sudo docker ps`, you should see a list of Nucleus containers up.

If there are issues with either of these, it is likely there was an issue with the Lambda and/or SSM run commands that configure the instances. Browse to the Lambda Console (https://us-west-2.console.aws.amazon.com/lambda/home?region=us-west-2#/functions) and search for the respective Lambda Functions:
- ReverseProxyConfig-CustomResource
- NucleusServerConfig-CustomResource

Review the CloudWatch Logs for these functions.
​
### No service log entries, or unable to restart nitro-enclave service
If there are issues with either of these, it is likely there was an issue with the Lambda and/or SSM run commands that configure the instances. Browse to the Lambda Console and search for the `ReverseProxyConfig-CustomResource` Lambda Function, then review the CloudWatch Logs.

At times the Reverse Proxy custom resource Lambda function does not trigger on a initial stack deployment. If the reverse proxy instance is in a running state, but there are now invocations/logs, terminate the instance and give the auto scaling group a few minutes to create another one, and then try again. Afterwards, check the CloudWatch Logs for the Lambda function: `ReverseProxyAutoScalingLifecycleLambdaFunction`

### Additional NGINX Commands
View Nitro Enclaves Service Logs:

`sudo journalctl -u nginx.service`

Viewing Nginx Logs

`sudo cat /var/log/nginx/error.log`

`sudo cat /var/log/nginx/access.log`

Restart Nginx

`systemctl restart nginx.service`

### Additional Nucleus server notes
Review NVIDIA's Documentation - https://docs.omniverse.nvidia.com/prod_nucleus/prod_nucleus/enterprise/installation/quick_start_tips.html

default base stack and config location: `/opt/ove/`

default omniverse data dir: `/var/lib/omni/nucleus-data`

Interacting with the Nucleus Server docker compose stack:

`sudo docker-compose --env-file ./nucleus-stack.env -f ./nucleus-stack-ssl.yml pull`

`sudo docker-compose --env-file ./nucleus-stack.env -f ./nucleus-stack-ssl.yml up -d`

`sudo docker-compose --env-file ./nucleus-stack.env -f ./nucleus-stack-ssl.yml down`

`sudo docker-compose --env-file ./nucleus-stack.env -f ./nucleus-stack-ssl.yml ps`

Generate new secrets

`sudo rm -fr secrets && sudo ./generate-sample-insecure-secrets.sh`


## Getting Help
If you have questions as you explore this sample project, post them to the Issues section of this repository. To report bugs, request new features, or contribute to this open source project, see [CONTRIBUTING.md](./CONTRIBUTING.md).


## Changelog
To view the history and recent changes to this repository, see [CHANGELOG.md](./CHANGELOG.md)


## Security
See [CONTRIBUTING](./CONTRIBUTING.md) for more information.


## License
This sample code is licensed under the MIT-0 License. See the [LICENSE](./LICENSE) file.


## References
### NVIDIA Omniverse
[Learn more about the NVIDIA Omniverse Platform](https://www.nvidia.com/en-us/omniverse/)

### Omniverse Nucleus
[Learn more about the NVIDIA Omniverse Nucleus](https://docs.omniverse.nvidia.com/prod_nucleus/prod_nucleus/overview.html)


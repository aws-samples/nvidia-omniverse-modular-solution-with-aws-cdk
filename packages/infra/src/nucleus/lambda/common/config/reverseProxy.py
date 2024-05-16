# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: MIT-0

def get_config(artifacts_bucket_name: str, nucleus_address: str, full_domain: str) -> list[str]:
    return f'''
        echo "------------------------ REVERSE PROXY CONFIG ------------------------"
        echo "UPDATING PACKAGES ----------------------------------"
        sudo yum update -y

        echo "INSTALLING DEPENDENCIES ----------------------------------"
        sudo yum install -y aws-cfn-bootstrap gcc openssl-devel bzip2-devel libffi-devel zlib-devel python-pip nginx

        echo "INSTALLING REVERSE PROXY TOOLS ----------------------------------"
        cd /opt || exit 1
        sudo aws s3 cp --recursive s3://{artifacts_bucket_name}/tools/reverseProxy/ ./reverseProxy
        cd reverseProxy || exit 1
        sudo pip3 install -r requirements.txt
        sudo rpt generate-nginx-config --domain {full_domain} --server-address {nucleus_address}

        echo "STARTING NGINX ----------------------------------"
        sudo systemctl start nginx
        sudo systemctl enable nginx
    '''.splitlines()

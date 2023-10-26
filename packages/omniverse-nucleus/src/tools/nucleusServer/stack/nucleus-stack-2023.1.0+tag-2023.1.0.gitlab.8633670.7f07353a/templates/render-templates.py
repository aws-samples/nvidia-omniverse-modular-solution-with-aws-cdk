#!/usr/bin/env python3.8

import os
import sys
from pprint import pprint

bin_path = os.path.dirname(os.path.realpath(__file__))

stack_template_file = 'nucleus-stack.template.yml'
env_template_file = 'nucleus-stack.template.env'

ssl_stack_out = f'{bin_path}/../base_stack/nucleus-stack-ssl.yml'
base_stack_out = f'{bin_path}/../base_stack/nucleus-stack-no-ssl.yml'
env_file_out = f'{bin_path}/../base_stack/nucleus-stack.env'

from jinja2 import Environment, FileSystemLoader

env = Environment(loader=FileSystemLoader(bin_path),
                   trim_blocks=True,
                   lstrip_blocks=True)



# Render base stack template

template = env.get_template(stack_template_file)

with open(ssl_stack_out, 'w') as h:
  h.write(template.render(ssl=True))

with open(base_stack_out, 'w') as h:
  h.write(template.render(ssl=False))

# Render env template

template = env.get_template(env_template_file)

v = {
       #'eula_accepted': 1, 
       'eula_accepted': 0, 
       #'security_reviewed': 1, 
       'security_reviewed': 0, 
       'instance_name': 'my_omniverse',
       'server_ip_or_host': 'SERVER_IP_OR_DNS_HOSTNAME_HERE', 
       'ssl_ingress_host': 'my-ssl-nucleus.my-company.com', 
       'ssl_ingress_port': 443, 
       'master_password': '123456',
       'service_password': '123456',
       'container_subnet': '192.168.2.0/26',
       #'container_subnet': '192.168.22.0/26',
       'data_root': '/var/lib/omni/nucleus-data',
       'lft_compression': 0,
       'auth_root_of_trust_pub': './secrets/auth_root_of_trust.pub',
       'auth_root_of_trust_pri': './secrets/auth_root_of_trust.pem',
       'auth_root_of_trust_long_term_pub': './secrets/auth_root_of_trust_lt.pub',
       'auth_root_of_trust_long_term_pri': './secrets/auth_root_of_trust_lt.pem',
       'pwd_salt': './secrets/pwd_salt',
       'lft_salt': './secrets/lft_salt',
       'discovery_registration_token': "./secrets/svc_reg_token",

       'ports_web': 80, 
    }

with open(env_file_out, 'w') as h:
  h.write(template.render(values=v))

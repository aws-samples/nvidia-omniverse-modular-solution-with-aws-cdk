# Enterprise Nucleus Server Readme

Welcome to Enterprise Nucleus Server compose and configuration files! 

If you have not already, please ensure to read thru general overview 
and installation sections of Omniverse Nucleus Documentation at
http://docs.omniverse.nvidia.com/nucleus

# Notes

* `base_stack` directory contains the Base Nucleus Stack with all it's services
  and deployment tooling.

  * Note that there are two compose files - `nucleus-stack-no-ssl.yml` and 
    `nucleus-stack-ssl.yml` - in the base stack. One of them should only be used
    when standing up a stack with no SSL, and another when standing up a stack
    that SSL is to be used with. 

    For more information on SSL, refer to the `.env` file and 
    http://docs.omniverse.nvidia.com/nucleus/ssl

  * Additionally, this dir contains data upgrade and data verification stacks
    (`nucleus-upgrade-db.yml` and  `nucleus-verify-db.yml`) that can be 
    run as utilities to upgrade and verify Nucleus's internal DB as required.

    Note that Nucleus will automatically upgrade and verify your DB (and 
    not launch if it fails).
 
    These additional files can be used if more manual process is desired.

    Launch them in foreground with your .env file, and observe the results. 

    Note: verification should be run *after* upgrade - in other words, 
    verifier inclided in this version can only verify data of this, and not
    other, versions of Nucleus. 

    IMPORTANT: Nucleus Stack must be stopped to perform verification and/or
    IMPORTANT: upgrades.

* `navigator` directory contains standalone Navigator stack. This allows you 
  to stand up Omniverse Navigator as a separate service in your environment if 
  you so desire. 

  Standalone Navigator instances allow users to connect to any number 
  of Enterprise Nucleus servers, and manage their content in one place. 

* `sso` directory contains the SSO Gateway Stack, required for Single Sign On integration

* `ssl` directory contains a sample section of NGINX config file as an example
  of a working Ingress Router setup required for SSL. 

  For more information, see SSL docs at
  http://docs.omniverse.nvidia.com/nucleus/ssl

* `templates` directory contains Jinja templates for base stack files in case
  you wish to use them in your automation. A sample rendering script is 
  included - in fact, it's *the* script used in generating base stack and env
  files in our build system.

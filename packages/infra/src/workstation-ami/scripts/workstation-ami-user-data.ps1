<powershell>
# download and install NVIDIA GRID drivers
Invoke-Expression -Command "cd C:\Users\Administrator\Downloads\"
$ProgressPreference = 'SilentlyContinue'
Invoke-WebRequest -Uri "https://s3.us-east-1.amazonaws.com/ec2-windows-nvidia-drivers/grid-15.0/527.41_grid_win10_win11_server2019_server2022_dch_64bit_international_aws_swl.exe" -OutFile .\nvidia-grid-drivers.exe
$ProgressPreference = 'Continue'
Start-Process -Wait -FilePath ".\nvidia-grid-drivers.exe" -Verb RunAs -ArgumentList "-s"
Invoke-Expression -Command "reg add ""HKLM\SOFTWARE\NVIDIA Corporation\Global\GridLicensing"" /v NvCplDisableManageLicensePage /t REG_DWORD /d 1"
Invoke-Expression -Command "reg add ""HKLM\SOFTWARE\NVIDIA Corporation\Global\GridLicensing"" /v FeatureType /t REG_DWORD /d 0"
Invoke-Expression -Command "reg add ""HKLM\SOFTWARE\NVIDIA Corporation\Global\GridLicensing"" /v IgnoreSP /t REG_DWORD /d 1"
Invoke-Expression -Command "C:\Windows\System32\DriverStore\FileRepository\nvgridsw_aws.inf_amd64_80ca7b932364d69c\nvidia-smi --applications-clocks=6250,1710"
# download and install NICE DCV server
$ProgressPreference = 'SilentlyContinue'
Invoke-WebRequest -Uri "https://d1uj6qtbmh3dt5.cloudfront.net/2023.0/Servers/nice-dcv-server-x64-Release-2023.0-15487.msi" -OutFile .\nice-dcv-server.msi
$ProgressPreference = 'Continue'
Start-Process -Wait -FilePath "msiexec.exe" -Verb RunAs -ArgumentList "/i nice-dcv-server ADDLOCAL=ALL AUTOMATIC_SESSION_OWNER=Administrator /quiet /l*v dcv_install_log.txt"
# download and install NVIDIA Omniverse Launcher
$ProgressPreference = 'SilentlyContinue'
Invoke-WebRequest -Uri "https://install.launcher.omniverse.nvidia.com/installers/omniverse-launcher-win.exe" -OutFile .\nvidia-omniverse-launcher.exe
$ProgressPreference = 'Continue'
Start-Process -Wait -FilePath ".\nvidia-omniverse-launcher.exe" -Verb RunAs -ArgumentList "/S"
# verify the installed components
Invoke-Expression -Command "cd C:\Users\Administrator\Documents"
Invoke-Expression -Command "echo ""# Beginning of setup verification log."" > setup_verification_log.txt"
Invoke-Expression -Command "echo ""# Empty lines and values indicates an issue with the installation."" >> setup_verification_log.txt"
Invoke-Expression -Command "echo ""### Downloaded installers."" >> setup_verification_log.txt"
Invoke-Expression -Command "dir C:\Users\Administrator\Downloads\nvidia-grid-drivers.exe >> setup_verification_log.txt"
Invoke-Expression -Command "dir C:\Users\Administrator\Downloads\nice-dcv-server.msi >> setup_verification_log.txt"
Invoke-Expression -Command "dir C:\Users\Administrator\Downloads\nvidia-omniverse-launcher.exe >> setup_verification_log.txt"
Invoke-Expression -Command "echo ""### NVIDIA GRID driver installation."" >> setup_verification_log.txt"
Invoke-Expression -Command "C:\Windows\System32\DriverStore\FileRepository\nvgridsw_aws.inf_amd64_80ca7b932364d69c\nvidia-smi.exe --query-gpu=gpu_name,driver_version --format=csv >> setup_verification_log.txt"
Invoke-Expression -Command "reg query ""HKLM\SOFTWARE\NVIDIA Corporation\Global\GridLicensing"" /v NvCplDisableManageLicensePage >> setup_verification_log.txt"
Invoke-Expression -Command "reg query ""HKLM\SOFTWARE\NVIDIA Corporation\Global\GridLicensing"" /v FeatureType >> setup_verification_log.txt"
Invoke-Expression -Command "reg query ""HKLM\SOFTWARE\NVIDIA Corporation\Global\GridLicensing"" /v IgnoreSP >> setup_verification_log.txt"
Invoke-Expression -Command "echo ""### NICE DCV installed server."" >> setup_verification_log.txt"
Get-Service -Name "dcvserver" >> setup_verification_log.txt
Invoke-Expression -Command "echo ""### NVIDIA Omniverse Launcher installation."" >> setup_verification_log.txt"
Invoke-Expression -Command "dir ""C:\Users\Administrator\AppData\Local\Programs\omniverse-launcher\NVIDIA Omniverse Launcher.exe"" >> setup_verification_log.txt"
Invoke-Expression -Command "echo ""# End of setup verification log."" >> setup_verification_log.txt"
# restart the Windows server
Restart-Computer
</powershell>
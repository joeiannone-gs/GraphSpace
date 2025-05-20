import pulumi
import pulumi_aws as aws

# 1. Security Group: Allow SSH and HTTP
web_sg = aws.ec2.SecurityGroup(
    "web-sg",
    description="Allow SSH, HTTP and custom ports",
    ingress=[
        aws.ec2.SecurityGroupIngressArgs(
            protocol="tcp", from_port=22, to_port=22, cidr_blocks=["0.0.0.0/0"]
        ),
        aws.ec2.SecurityGroupIngressArgs(
            protocol="tcp", from_port=80, to_port=80, cidr_blocks=["0.0.0.0/0"]
        ),
        aws.ec2.SecurityGroupIngressArgs(
            protocol="tcp", from_port=3000, to_port=3000, cidr_blocks=["0.0.0.0/0"]
        ),
        aws.ec2.SecurityGroupIngressArgs(
            protocol="tcp", from_port=8080, to_port=8080, cidr_blocks=["0.0.0.0/0"]
        ),
    ],
    egress=[
        aws.ec2.SecurityGroupEgressArgs(
            protocol="-1", from_port=0, to_port=0, cidr_blocks=["0.0.0.0/0"]
        ),
    ],
)

# 2. SSH Key Pair
with open('./my-key.pub', 'r') as f:
    key_content = f.read()

ssh_key = aws.ec2.KeyPair(
    "web-key",
    public_key=key_content
)

# 3. Find a valid Amazon Linux 2 AMI in your region
ami = aws.ec2.get_ami(
    most_recent=True,
    owners=["amazon"],
    filters=[
        aws.ec2.GetAmiFilterArgs(name="name", values=["Deep Learning Base OSS Nvidia Driver GPU AMI (Amazon Linux 2023)*"]),
        aws.ec2.GetAmiFilterArgs(name="architecture", values=["x86_64"]),
    ],
)


# 4. EC2 Instance with user data to run a simple HTTP server
# user_data = """#!/bin/bash
# echo 'Hello, Pulumi!' > index.html
# nohup python3 -m http.server 3000 &
# """
with open('user_data.txt', 'r') as f:
    user_data = f.read()

server = aws.ec2.Instance(
    "web-server",
    instance_type="g4dn.xlarge",
    ami=ami.id,
    vpc_security_group_ids=[web_sg.id],
    key_name=ssh_key.key_name,
    user_data=user_data,
    tags={"Name": "pulumi-web-server"},
    # root_block_device={
    #     "volume_size": 30,
    # },
)



existing_eip = aws.ec2.get_elastic_ip(
    public_ip="54.187.246.153"
)

eip_association = aws.ec2.EipAssociation(
    "myEipAssociation",
    instance_id=server.id,
    allocation_id=existing_eip.id
)


# 5. Export public IP and DNS
pulumi.export("public_ip", server.public_ip)
pulumi.export("public_dns", server.public_dns)

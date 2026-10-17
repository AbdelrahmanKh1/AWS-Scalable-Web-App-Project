# AWS-Scalable-Web-App-Project

# Project 1: Scalable Web Application with ALB and Auto Scaling

## Architecture Diagram

```mermaid
flowchart TB
    Users(["Users / Internet"])
    Admin(["Cloud Admin / Ops"])

    subgraph EDGE["Global Edge Layer"]
        direction LR
        R53["Route 53<br/>DNS Alias Record"]
        CF["CloudFront<br/>CDN + ACM TLS"]
        WAF["AWS WAF<br/>Web ACL on CloudFront"]
    end

    subgraph REGION["AWS Region"]
        subgraph VPC["VPC 10.0.0.0/16"]
            IGW["Internet Gateway"]
            ALB["Application Load Balancer<br/>Spans Public Subnets A and B<br/>SG: alb-sg (CloudFront prefix list only)"]
            ASG{{"Auto Scaling Group<br/>Target Tracking: CPU / Requests per Target<br/>Min 2 / Desired 2 / Max N"}}
            VPCE["VPC Interface Endpoints<br/>ssm, ssmmessages, ec2messages"]

            subgraph AZA["Availability Zone A"]
                subgraph PUBA["Public Subnet A 10.0.1.0/24<br/>NACL: public-nacl"]
                    NATA["NAT Gateway A"]
                end
                subgraph APPA["Private App Subnet A 10.0.11.0/24<br/>NACL: private-nacl"]
                    EC2A["EC2 Instance A<br/>SG: app-sg<br/>SSM Agent + IAM Role"]
                end
                subgraph DBA["Private DB Subnet A 10.0.21.0/24<br/>NACL: db-nacl"]
                    RDSP[("RDS Primary<br/>MySQL / PostgreSQL<br/>SG: db-sg")]
                end
            end

            subgraph AZB["Availability Zone B"]
                subgraph PUBB["Public Subnet B 10.0.2.0/24<br/>NACL: public-nacl"]
                    NATB["NAT Gateway B"]
                end
                subgraph APPB["Private App Subnet B 10.0.12.0/24<br/>NACL: private-nacl"]
                    EC2B["EC2 Instance B<br/>SG: app-sg<br/>SSM Agent + IAM Role"]
                end
                subgraph DBB["Private DB Subnet B 10.0.22.0/24<br/>NACL: db-nacl"]
                    RDSS[("RDS Standby<br/>Multi-AZ Replica<br/>SG: db-sg")]
                end
            end
        end
    end

    subgraph MGMT["Management and Observability"]
        direction LR
        SSM["Systems Manager<br/>Session Manager"]
        CW["CloudWatch<br/>Metrics, Logs, Alarms"]
        SNS["SNS Topic<br/>Alert Notifications"]
    end

    %% Request path
    Users -->|"HTTPS"| R53
    R53 --> CF
    CF -->|"Inspected by"| WAF
    WAF -->|"Filtered traffic + origin header"| IGW
    IGW --> ALB
    ALB -->|"HTTP/HTTPS"| EC2A
    ALB -->|"HTTP/HTTPS"| EC2B

    %% Auto Scaling
    ASG -.->|"Launches / replaces"| EC2A
    ASG -.->|"Launches / replaces"| EC2B

    %% Data layer
    EC2A -->|"3306 / 5432"| RDSP
    EC2B -->|"3306 / 5432"| RDSP
    RDSP <-->|"Synchronous replication"| RDSS

    %% Outbound internet access for private instances
    EC2A -.->|"Egress"| NATA
    EC2B -.->|"Egress"| NATB
    NATA -.-> IGW
    NATB -.-> IGW

    %% Admin access without SSH or bastion
    Admin -->|"IAM-authenticated"| SSM
    SSM --> VPCE
    VPCE -->|"Session"| EC2A
    VPCE -->|"Session"| EC2B

    %% Monitoring and alerting
    ALB -.->|"Metrics"| CW
    EC2A -.->|"Metrics / Logs"| CW
    EC2B -.->|"Metrics / Logs"| CW
    RDSP -.->|"Metrics"| CW
    CW ==>|"Alarms drive scaling policies"| ASG
    CW -->|"Alarm actions"| SNS
    SNS -->|"Email / SMS"| Admin

    classDef edge fill:#fff4e5,stroke:#e08a00,color:#000
    classDef compute fill:#e8f1ff,stroke:#2b6cb0,color:#000
    classDef data fill:#e6f7ec,stroke:#2f855a,color:#000
    classDef mgmt fill:#f3e8ff,stroke:#7b3fb5,color:#000
    classDef net fill:#f1f1f1,stroke:#555,color:#000

    class R53,CF,WAF edge
    class ALB,ASG,EC2A,EC2B compute
    class RDSP,RDSS data
    class SSM,CW,SNS,VPCE mgmt
    class IGW,NATA,NATB net
```

## Legend

| Line style | Meaning |
| --- | --- |
| Solid arrow | Primary request, data, or access path |
| Dotted arrow | Control plane, egress, or telemetry |
| Thick arrow | CloudWatch alarms triggering Auto Scaling |

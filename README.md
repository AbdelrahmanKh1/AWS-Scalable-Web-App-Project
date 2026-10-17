# Project 1: Scalable Web Application with ALB and Auto Scaling

## Architecture Diagram

```mermaid
flowchart TB
    Users(["👥 Users / Internet"])
    Admin(["🧑‍💻 Cloud Admin / Ops"])

    subgraph EDGE["🌍 Global Edge Layer"]
        direction LR
        R53["🧭 Route 53<br/>DNS Alias Record"]
        CF["🚀 CloudFront<br/>CDN + ACM TLS"]
        WAF["🛡️ AWS WAF<br/>Web ACL on CloudFront"]
    end

    subgraph REGION["☁️ AWS Region"]
        subgraph VPC["🔒 VPC 10.0.0.0/16"]
            IGW["🚪 Internet Gateway"]
            ALB["⚖️ Application Load Balancer<br/>Spans Public Subnets A and B<br/>SG: alb-sg (CloudFront prefix list, 443)"]
            ASG{{"📈 Auto Scaling Group<br/>Target Tracking: CPU / Requests per Target<br/>Min 2 / Desired 2 / Max 6"}}
            VPCE["🔌 VPC Interface Endpoints<br/>ssm, ssmmessages, ec2messages"]

            subgraph AZA["📍 Availability Zone A"]
                subgraph PUBA["🟩 Public Subnet A 10.0.1.0/24<br/>NACL: public-nacl"]
                    NATA["🌐 NAT Gateway A"]
                end
                subgraph APPA["🟦 Private App Subnet A 10.0.11.0/24<br/>NACL: private-nacl"]
                    EC2A["🖥️ EC2 Instance A<br/>App port 8080<br/>SG: app-sg<br/>SSM Agent + IAM Role"]
                end
                subgraph DBA["🟪 Private DB Subnet A 10.0.21.0/24<br/>NACL: db-nacl"]
                    RDSP[("🗄️ RDS Primary<br/>PostgreSQL 5432<br/>SG: db-sg")]
                end
            end

            subgraph AZB["📍 Availability Zone B"]
                subgraph PUBB["🟩 Public Subnet B 10.0.2.0/24<br/>NACL: public-nacl"]
                    NATB["🌐 NAT Gateway B"]
                end
                subgraph APPB["🟦 Private App Subnet B 10.0.12.0/24<br/>NACL: private-nacl"]
                    EC2B["🖥️ EC2 Instance B<br/>App port 8080<br/>SG: app-sg<br/>SSM Agent + IAM Role"]
                end
                subgraph DBB["🟪 Private DB Subnet B 10.0.22.0/24<br/>NACL: db-nacl"]
                    RDSS[("🗄️ RDS Standby<br/>Multi-AZ Replica<br/>SG: db-sg")]
                end
            end
        end
    end

    subgraph MGMT["🛠️ Management and Observability"]
        direction LR
        SSM["🔑 Systems Manager<br/>Session Manager"]
        CW["📊 CloudWatch<br/>Metrics, Logs, Alarms"]
        SNS["🔔 SNS Topic<br/>Alert Notifications"]
    end

    %% Request path (edges 0-4)
    Users -->|"HTTPS"| R53
    R53 --> CF
    CF -->|"Inspected by"| WAF
    WAF -->|"Filtered traffic + origin header"| IGW
    IGW --> ALB
    %% ALB to app tier (edges 5-6)
    ALB -->|"HTTP 8080"| EC2A
    ALB -->|"HTTP 8080"| EC2B

    %% Auto Scaling (edges 7-8)
    ASG -.->|"Launches / replaces"| EC2A
    ASG -.->|"Launches / replaces"| EC2B

    %% Data layer (edges 9-11)
    EC2A -->|"5432"| RDSP
    EC2B -->|"5432"| RDSP
    RDSP <-->|"Synchronous replication"| RDSS

    %% Outbound internet access (edges 12-15)
    EC2A -.->|"Egress"| NATA
    EC2B -.->|"Egress"| NATB
    NATA -.-> IGW
    NATB -.-> IGW

    %% Admin access without SSH or bastion (edges 16-19)
    Admin -->|"IAM-authenticated"| SSM
    SSM --> VPCE
    VPCE -->|"Session"| EC2A
    VPCE -->|"Session"| EC2B

    %% Monitoring and alerting (edges 20-26)
    ALB -.->|"Metrics"| CW
    EC2A -.->|"Metrics / Logs"| CW
    EC2B -.->|"Metrics / Logs"| CW
    RDSP -.->|"Metrics"| CW
    CW ==>|"Alarms drive scaling policies"| ASG
    CW -->|"Alarm actions"| SNS
    SNS -->|"Email / SMS"| Admin

    %% Node styles
    classDef cUser fill:#263238,stroke:#000000,color:#ffffff,stroke-width:2px
    classDef cEdge fill:#FF9900,stroke:#B26A00,color:#1b1b1b,stroke-width:2px
    classDef cNet fill:#43A047,stroke:#1B5E20,color:#ffffff,stroke-width:2px
    classDef cPub fill:#66BB6A,stroke:#1B5E20,color:#0b2e13,stroke-width:2px
    classDef cApp fill:#1E88E5,stroke:#0D47A1,color:#ffffff,stroke-width:2px
    classDef cDb fill:#8E24AA,stroke:#4A148C,color:#ffffff,stroke-width:2px
    classDef cMgmt fill:#D81B60,stroke:#880E4F,color:#ffffff,stroke-width:2px

    class Users,Admin cUser
    class R53,CF,WAF cEdge
    class IGW,NATA,NATB cNet
    class ALB,ASG,EC2A,EC2B cApp
    class RDSP,RDSS cDb
    class SSM,CW,SNS,VPCE cMgmt

    %% Subgraph (container) styles
    style EDGE fill:#FFF3E0,stroke:#FB8C00,stroke-width:3px,color:#7A4100
    style REGION fill:#F5F7FA,stroke:#455A64,stroke-width:2px,stroke-dasharray:6 4,color:#263238
    style VPC fill:#EEF4FF,stroke:#1A237E,stroke-width:3px,color:#1A237E
    style AZA fill:#FFFFFF,stroke:#78909C,stroke-width:2px,stroke-dasharray:6 4,color:#37474F
    style AZB fill:#FFFFFF,stroke:#78909C,stroke-width:2px,stroke-dasharray:6 4,color:#37474F
    style PUBA fill:#E8F5E9,stroke:#2E7D32,stroke-width:3px,color:#1B5E20
    style PUBB fill:#E8F5E9,stroke:#2E7D32,stroke-width:3px,color:#1B5E20
    style APPA fill:#E3F2FD,stroke:#1565C0,stroke-width:3px,color:#0D47A1
    style APPB fill:#E3F2FD,stroke:#1565C0,stroke-width:3px,color:#0D47A1
    style DBA fill:#F3E5F5,stroke:#7B1FA2,stroke-width:3px,color:#4A148C
    style DBB fill:#F3E5F5,stroke:#7B1FA2,stroke-width:3px,color:#4A148C
    style MGMT fill:#FCE4EC,stroke:#C2185B,stroke-width:3px,color:#880E4F

    %% Edge (arrow) colors
    linkStyle 0,1,2,3,4 stroke:#FB8C00,stroke-width:3px
    linkStyle 5,6 stroke:#1E88E5,stroke-width:3px
    linkStyle 7,8 stroke:#607D8B,stroke-width:2px
    linkStyle 9,10,11 stroke:#8E24AA,stroke-width:3px
    linkStyle 12,13,14,15 stroke:#43A047,stroke-width:2px
    linkStyle 16,17,18,19 stroke:#D81B60,stroke-width:2px
    linkStyle 20,21,22,23 stroke:#90A4AE,stroke-width:2px
    linkStyle 24 stroke:#E53935,stroke-width:4px
    linkStyle 25,26 stroke:#D81B60,stroke-width:2px
```

## Legend

| Color | Layer | Contents |
| --- | --- | --- |
| 🟧 Orange | Global edge | Route 53, CloudFront, WAF |
| 🟩 Green | Public subnets and gateways | NAT Gateways, Internet Gateway |
| 🟦 Blue | Private application tier | ALB, Auto Scaling Group, EC2 instances (port 8080) |
| 🟪 Purple | Database tier | RDS PostgreSQL Multi-AZ (port 5432) |
| 🟥 Magenta | Management and observability | Session Manager, CloudWatch, SNS, VPC endpoints |

| Line style | Meaning |
| --- | --- |
| Solid arrow | Primary request, data, or access path |
| Dotted arrow | Control plane, egress, or telemetry |
| Thick red arrow | CloudWatch alarms triggering Auto Scaling |

# CostQ Web Application

CostQ 是一个基于 AWS Bedrock AgentCore 的智能云成本分析和优化平台。

## 架构概览

```
┌─────────────────────────────────────────────────────────────┐
│  Route 53 → CloudFront → ELB → EKS (Frontend + Backend)    │
│                              ↓                              │
│                    AgentCore Runtime (Agent)                │
│                              ↓                              │
│                    AgentCore Gateway → MCP Servers          │
└─────────────────────────────────────────────────────────────┘
```

## 技术栈

### 前端
- **框架**: React 18 + TypeScript
- **构建工具**: Vite
- **UI 库**: Ant Design 5
- **状态管理**: Zustand
- **国际化**: 支持中文、英文、日文

### 后端
- **框架**: FastAPI (Python 3.13)
- **数据库**: PostgreSQL
- **认证**: JWT
- **通信**: SSE (Server-Sent Events) 流式通信

### 部署
- **容器化**: Docker 多阶段构建
- **编排**: Kubernetes (EKS)
- **CI/CD**: GitHub Actions
- **云平台**: AWS

## 主要功能

- 🤖 **AI 智能对话**: 基于 Claude 3.5 Sonnet 的成本分析助手
- 💰 **成本分析**: AWS/GCP 云成本分析和优化建议
- 📊 **RI/SP 分析**: Reserved Instance 和 Savings Plans 推荐
- ⚡ **实时流式输出**: SSE 流式通信，实时展示分析结果
- 🔐 **多租户支持**: 企业级多租户架构
- 📈 **告警管理**: 自定义成本告警和通知
- 🌍 **多云支持**: AWS 和 GCP 账号管理

## 快速开始

### 前置要求

- Node.js 20+
- Python 3.13+
- Docker
- kubectl (部署到 Kubernetes 时)

### 本地开发

#### 1. 安装依赖

```bash
# 后端依赖
pip install -r requirements.txt

# 前端依赖
cd frontend
npm install
```

#### 2. 配置环境变量

创建 `.env` 文件：

```bash
# 数据库
RDS_SECRET_NAME=costq/rds/postgresql-dev

# AgentCore
AGENTCORE_RUNTIME_ARN=arn:aws:bedrock:ap-northeast-1:xxx:agentcore-runtime/xxx

# AWS
AWS_PROFILE=your-profile
AWS_REGION=ap-northeast-1
```

#### 3. 启动开发服务器

```bash
# 启动后端
./start.sh

# 启动前端（新终端）
cd frontend
npm run dev
```

访问 http://localhost:5173

### Docker 部署

#### 构建镜像

```bash
# 构建并推送到 ECR
./deployment/scripts/01-build-and-push.sh
```

#### 部署到 EKS

```bash
# 部署应用
./deployment/scripts/02-deploy-app.sh <image-tag>
```

## 项目结构

```
costq-web/
├── frontend/                # React 前端
│   ├── src/
│   │   ├── components/     # UI 组件
│   │   ├── contexts/       # React Context
│   │   ├── services/       # API 客户端
│   │   ├── stores/         # Zustand 状态管理
│   │   └── types/          # TypeScript 类型定义
│   └── package.json
│
├── backend/                 # FastAPI 后端
│   ├── api/                # API 端点
│   ├── config/             # 配置管理
│   ├── models/             # 数据模型
│   ├── services/           # 业务逻辑
│   └── main.py
│
├── deployment/              # 部署配置
│   ├── k8s/                # Kubernetes 配置
│   └── scripts/            # 部署脚本
│
├── Dockerfile              # 多阶段构建
├── requirements.txt        # Python 依赖
└── pyproject.toml          # 项目配置
```

## 环境变量

### 必需环境变量

| 变量名 | 说明 |
|--------|------|
| `AGENTCORE_RUNTIME_ARN` | AgentCore Runtime ARN |
| `RDS_SECRET_NAME` | 数据库密钥名称 |
| `ENCRYPTION_KEY` | Fernet 加密密钥 |

### 可选环境变量

| 变量名 | 默认值 | 说明 |
|--------|--------|------|
| `BEDROCK_MODEL_ID` | `us.anthropic.claude-sonnet-4-20250514-v1:0` | Bedrock 模型 ID |
| `AWS_REGION` | `ap-northeast-1` | AWS 区域 |
| `LOG_LEVEL` | `INFO` | 日志级别 |

## API 文档

启动后端后，访问：
- Swagger UI: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc

## 部署架构

### EKS 部署

- **集群**: costq-eks-cluster
- **Namespace**: costq-fastapi
- **Ingress**: ALB + Route 53
- **域名**: https://costq.cloudminos.jp

### 容器配置

- **App 容器**: FastAPI (端口 8000)
- **Nginx 容器**: 静态文件服务 (端口 80)

### Marketplace Metering CronJob

- 清单文件: [deployment/k8s/marketplace-metering-cronjob.yaml](/Users/liyuguang/data/gitworld/costq/costq-web/deployment/k8s/marketplace-metering-cronjob.yaml)
- 作用: 每小时执行一次 AWS Marketplace metering job
- 执行入口: `python -m backend.jobs.marketplace_metering_job --fail-on-error`
- 默认调度: `Asia/Tokyo` 时区每小时第 15 分钟

部署:

```bash
kubectl apply -f deployment/k8s/marketplace-metering-cronjob.yaml
```

查看状态:

```bash
kubectl get cronjob marketplace-metering -n costq-fastapi
kubectl get jobs -n costq-fastapi -l component=marketplace-metering
kubectl logs -n costq-fastapi job/<job-name>
```

## 监控和日志

### CloudWatch 日志组

- 应用日志: `/aws/eks/costq-fastapi/app`
- Nginx 日志: `/aws/eks/costq-fastapi/nginx`

### 健康检查

- **后端**: `GET /health`
- **探针**: Liveness + Readiness Probe

## 开发规范

### 代码风格

- Python: Ruff + Black
- TypeScript: ESLint + Prettier
- 提交信息: Conventional Commits

### 测试

```bash
# 后端测试
pytest

# 前端测试
cd frontend
npm test
```

## 相关项目

- [costq-agents](https://github.com/tonygitworld/costq-agents) - Agent 代码
- [costq-mcp-servers](https://github.com/tonygitworld/costq-mcp-servers) - MCP Servers

## 许可证

Private - All Rights Reserved

## 联系方式

- **项目**: CostQ
- **GitHub**: https://github.com/tonygitworld/costq-web

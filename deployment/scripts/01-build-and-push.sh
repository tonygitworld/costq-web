#!/bin/bash
set -e

# ==================== 构建并推送镜像到 ECR ====================
# 用途: 构建 Docker 镜像并推送到 ECR
# ====================

REGION="ap-northeast-1"
ACCOUNT_ID="000451883532"
ECR_REPO="costq-fastapi"
PROFILE="3532"
ECR_URL="${ACCOUNT_ID}.dkr.ecr.${REGION}.amazonaws.com/${ECR_REPO}"

echo ""
echo "============================================================"
echo "🐳 步骤 1/2: 构建并推送 Docker 镜像"
echo "============================================================"
echo ""

# 切换到项目根目录
cd "$(dirname "$0")/../.."

# 检查 Docker
if ! command -v docker &> /dev/null; then
    echo "❌ 错误: Docker 未安装"
    exit 1
fi

echo "✅ Docker 已安装"
echo ""

# 登录 ECR
echo "→ 登录 ECR..."
aws ecr get-login-password --region "$REGION" --profile "$PROFILE" | \
    docker login --username AWS --password-stdin "${ACCOUNT_ID}.dkr.ecr.${REGION}.amazonaws.com"

echo "✅ ECR 登录成功"
echo ""

# 构建应用镜像 (App)
echo "→ 构建应用镜像 (App)..."
docker buildx build \
    --platform linux/amd64 \
    --target app-runtime \
    --cache-from ${ECR_URL}:app-latest \
    --build-arg BUILDKIT_INLINE_CACHE=1 \
    -t costq-app:latest \
    -f Dockerfile \
    . || {
        echo "❌ App 镜像构建失败"
        exit 1
    }

# 构建 Nginx 镜像 (Frontend)
echo "→ 构建 Nginx 镜像 (Frontend)..."
docker buildx build \
    --platform linux/amd64 \
    --target nginx-runtime \
    --cache-from ${ECR_URL}:nginx-latest \
    --build-arg BUILDKIT_INLINE_CACHE=1 \
    -t costq-nginx:latest \
    -f Dockerfile \
    . || {
        echo "❌ Nginx 镜像构建失败"
        exit 1
    }

echo "✅ 镜像构建完成"
echo ""

# 打标签
echo "→ 打标签..."
TIMESTAMP=$(date +%Y%m%d-%H%M%S)

# App Tags
docker tag costq-app:latest ${ECR_URL}:app-latest
docker tag costq-app:latest ${ECR_URL}:app-${TIMESTAMP}

# Nginx Tags
docker tag costq-nginx:latest ${ECR_URL}:nginx-latest
docker tag costq-nginx:latest ${ECR_URL}:nginx-${TIMESTAMP}

echo "✅ 标签已创建"
echo ""

# 推送到 ECR
echo "→ 推送镜像到 ECR..."
docker push ${ECR_URL}:app-latest
docker push ${ECR_URL}:app-${TIMESTAMP}
docker push ${ECR_URL}:nginx-latest
docker push ${ECR_URL}:nginx-${TIMESTAMP}

echo "✅ 所有镜像已推送到 ECR"
echo ""

echo "============================================================"
echo "✅ 镜像构建和推送完成"
echo "============================================================"
echo ""
echo "ECR 仓库: ${ECR_URL}"
echo "App 标签: app-latest, app-${TIMESTAMP}"
echo "Nginx 标签: nginx-latest, nginx-${TIMESTAMP}"
echo ""
echo "查看镜像:"
echo "  aws ecr describe-images --repository-name ${ECR_REPO} --region ${REGION}"
echo ""
echo "继续部署:"
echo "  ./deployment/scripts/02-deploy-app.sh ${TIMESTAMP}"
echo ""

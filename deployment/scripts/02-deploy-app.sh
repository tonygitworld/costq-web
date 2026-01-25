#!/bin/bash
set -e

# ==================== 部署应用到 EKS ====================
# 用途: 使用 kubectl 部署应用到 EKS
# 使用方法:
#   ./02-deploy-app.sh <image-tag>
#
# 参数说明:
#   image-tag : 必填，镜像时间戳标签（如 20251228-152049）
#
# 示例:
#   ./02-deploy-app.sh 20251228-152049
# ====================

NAMESPACE="costq-fastapi"
K8S_DIR="deployment/k8s"

# 检查参数
if [ -z "$1" ]; then
    echo ""
    echo "❌ 错误: 缺少镜像标签参数"
    echo ""
    echo "使用方法: $0 <image-tag>"
    echo ""
    echo "参数说明:"
    echo "  image-tag : 必填，镜像时间戳标签（从构建脚本输出中获取）"
    echo "              例如: 20251228-152049"
    echo ""
    echo "示例:"
    echo "  $0 20251228-152049"
    echo ""
    echo "提示:"
    echo "  1. 先运行构建脚本: ./deployment/scripts/01-build-and-push.sh"
    echo "  2. 从输出中复制时间戳标签（如 app-20251228-152049）"
    echo "  3. 使用该时间戳运行本脚本: $0 20251228-152049"
    echo ""
    exit 1
fi

IMAGE_TAG="$1"

echo ""
echo "============================================================"
echo "🚀 步骤 2/2: 部署应用到 EKS"
echo "============================================================"
echo "镜像标签: ${IMAGE_TAG}"
echo "命名空间: ${NAMESPACE}"
echo "============================================================"
echo ""

# 切换到项目根目录
cd "$(dirname "$0")/../.."

# 检查 kubectl
if ! command -v kubectl &> /dev/null; then
    echo "❌ 错误: kubectl 未安装"
    exit 1
fi

# 检查 secrets.env 文件
SECRETS_FILE="${K8S_DIR}/secrets.env"
if [ ! -f "$SECRETS_FILE" ]; then
    echo "❌ 错误: secrets.env 文件不存在"
    echo "   请先创建配置文件:"
    echo "   cp ${SECRETS_FILE}.example ${SECRETS_FILE}"
    echo "   vim ${SECRETS_FILE}"
    exit 1
fi

echo "✅ 检查完成"
echo ""

# 验证 ConfigMap 配置
echo "→ 验证 ConfigMap 配置..."
if ! grep -q "BEDROCK_MODEL_ID" "${K8S_DIR}/configmap.yaml"; then
    echo "⚠️  警告: configmap.yaml 缺少 BEDROCK_MODEL_ID 配置"
    echo "   将使用代码默认值（可能不是期望的模型）"
else
    CONFIGURED_MODEL=$(grep "BEDROCK_MODEL_ID:" "${K8S_DIR}/configmap.yaml" | awk '{print $2}' | tr -d '"')
    echo "✅ 已配置 Bedrock 模型: $CONFIGURED_MODEL"
fi
echo ""

# 验证集群连接
echo "→ 验证集群连接..."
kubectl cluster-info > /dev/null 2>&1 || {
    echo "❌ 错误: 无法连接到 Kubernetes 集群"
    echo "   请先配置 kubectl context:"
    echo "   aws eks update-kubeconfig --name costq-eks-cluster --region ap-northeast-1 --profile 3532"
    exit 1
}

echo "✅ 集群连接正常"
echo ""

# 检查 Secret 是否存在
echo "→ 检查 Kubernetes Secret..."
if kubectl get secret costq-fastapi-secrets -n "$NAMESPACE" &> /dev/null; then
    echo "✅ Secret 'costq-fastapi-secrets' 已存在（跳过更新）"
    echo "   如需更新，请手动执行:"
    echo "   kubectl delete secret costq-fastapi-secrets -n $NAMESPACE"
    echo "   kubectl create secret generic costq-fastapi-secrets --from-env-file=${SECRETS_FILE} -n $NAMESPACE"
else
    echo "→ 创建 Secret..."
    kubectl create secret generic costq-fastapi-secrets \
        --from-env-file="${SECRETS_FILE}" \
        -n "$NAMESPACE"
    echo "✅ Secret 已创建"
fi
echo ""

# 验证镜像是否存在于 ECR
echo "→ 验证镜像是否存在于 ECR..."
APP_IMAGE="000451883532.dkr.ecr.ap-northeast-1.amazonaws.com/costq-fastapi:app-${IMAGE_TAG}"
NGINX_IMAGE="000451883532.dkr.ecr.ap-northeast-1.amazonaws.com/costq-fastapi:nginx-${IMAGE_TAG}"

# 检查 app 镜像是否存在
APP_EXISTS=$(aws ecr describe-images \
    --repository-name costq-fastapi \
    --region ap-northeast-1 \
    --profile 3532 \
    --image-ids imageTag=app-${IMAGE_TAG} \
    --query 'imageDetails[0].imageTags' \
    --output text 2>/dev/null || echo "NOT_FOUND")

if [ "$APP_EXISTS" = "NOT_FOUND" ]; then
    echo "❌ 错误: 镜像 app-${IMAGE_TAG} 不存在于 ECR"
    echo ""
    echo "请检查:"
    echo "  1. 镜像标签是否正确（不要包含 'app-' 前缀）"
    echo "  2. 是否已运行构建脚本: ./deployment/scripts/01-build-and-push.sh"
    echo "  3. 构建是否成功推送到 ECR"
    echo ""
    echo "查看 ECR 中的所有镜像标签:"
    echo "  aws ecr describe-images --repository-name costq-fastapi --region ap-northeast-1 --profile 3532 --query 'sort_by(imageDetails,& imagePushedAt)[-5:].imageTags[]' --output table"
    echo ""
    exit 1
fi

# 检查 nginx 镜像是否存在
NGINX_EXISTS=$(aws ecr describe-images \
    --repository-name costq-fastapi \
    --region ap-northeast-1 \
    --profile 3532 \
    --image-ids imageTag=nginx-${IMAGE_TAG} \
    --query 'imageDetails[0].imageTags' \
    --output text 2>/dev/null || echo "NOT_FOUND")

if [ "$NGINX_EXISTS" = "NOT_FOUND" ]; then
    echo "❌ 错误: 镜像 nginx-${IMAGE_TAG} 不存在于 ECR"
    echo ""
    echo "请确保 app 和 nginx 镜像都已成功推送"
    echo ""
    exit 1
fi

echo "✅ 镜像验证成功"
echo "  App:   ${APP_IMAGE}"
echo "  Nginx: ${NGINX_IMAGE}"
echo ""

# 部署应用
echo "→ 部署应用（镜像标签: ${IMAGE_TAG}）..."
echo "   - 部署顺序: namespace → serviceaccount → configmap → deployment → service → ingress"
kubectl apply -f "${K8S_DIR}/namespace.yaml"
kubectl apply -f "${K8S_DIR}/serviceaccount.yaml"
kubectl apply -f "${K8S_DIR}/configmap.yaml"
kubectl apply -f "${K8S_DIR}/nginx-configmap.yaml"
kubectl apply -f "${K8S_DIR}/deployment.yaml"
kubectl apply -f "${K8S_DIR}/service.yaml"
kubectl apply -f "${K8S_DIR}/ingress.yaml"

# 更新 Deployment 使用带时间戳的镜像
echo "→ 更新 Deployment 镜像..."
kubectl set image deployment/costq-fastapi \
    app="${APP_IMAGE}" \
    nginx="${NGINX_IMAGE}" \
    -n "${NAMESPACE}"

echo "✅ 应用已部署（镜像: ${IMAGE_TAG}）"
echo ""

# 等待部署完成
echo "→ 等待 Deployment 就绪..."
kubectl rollout status deployment/costq-fastapi -n "$NAMESPACE" --timeout=5m

echo "✅ Deployment 已就绪"
echo ""

# 验证 ConfigMap 配置
echo "→ 验证 ConfigMap 配置..."
CONFIGMAP_MODEL=$(kubectl get configmap -n "$NAMESPACE" -l app=costq-fastapi -o yaml 2>/dev/null | grep "BEDROCK_MODEL_ID" | awk '{print $2}' | head -1)
if [ -z "$CONFIGMAP_MODEL" ]; then
    echo "⚠️  警告: ConfigMap 中未找到 BEDROCK_MODEL_ID"
    echo "   应用将使用代码默认值"
else
    echo "✅ ConfigMap 中的模型: $CONFIGMAP_MODEL"
fi
echo ""

# 验证 Pod 日志中的模型
echo "→ 验证 Pod 使用的模型..."
sleep 5  # 等待 Pod 启动日志
POD_MODEL=$(kubectl logs -n "$NAMESPACE" -l app=costq-fastapi -c app --tail=100 2>/dev/null | grep "🤖 创建单例BedrockModel" | grep -o "Model: [^,]*" | cut -d' ' -f2 | head -1)
if [ -z "$POD_MODEL" ]; then
    echo "⚠️  警告: 未能从日志中获取模型信息（Pod 可能还在启动）"
    echo "   稍后可以手动检查: kubectl logs -n $NAMESPACE deployment/costq-fastapi -c app | grep BedrockModel"
else
    echo "✅ Pod 实际使用的模型: $POD_MODEL"

    # 检查是否匹配预期
    if [[ "$POD_MODEL" == *"claude-sonnet-4"* ]]; then
        echo "✅ 模型配置正确（使用 Claude Sonnet 4）"
    elif [[ "$POD_MODEL" == *"deepseek"* ]]; then
        echo "❌ 警告: Pod 使用了 DeepSeek 模型，可能需要重新构建镜像"
    else
        echo "⚠️  警告: 未知模型 $POD_MODEL"
    fi
fi
echo ""

# 显示部署状态
echo "============================================================"
echo "📊 部署状态"
echo "============================================================"
echo ""

echo "→ Pods 状态:"
kubectl get pods -n "$NAMESPACE" -l app=costq-fastapi

echo ""
echo "→ Service 状态:"
kubectl get svc -n "$NAMESPACE"

echo ""
echo "→ Ingress 状态:"
kubectl get ingress -n "$NAMESPACE"

echo ""
echo "→ ALB 地址:"
ALB_HOSTNAME=$(kubectl get ingress costq-fastapi -n "$NAMESPACE" -o jsonpath='{.status.loadBalancer.ingress[0].hostname}' 2>/dev/null || echo "等待中...")

if [ "$ALB_HOSTNAME" != "等待中..." ]; then
    echo "✅ ALB 地址: https://$ALB_HOSTNAME"
    echo "✅ 域名访问: https://costq.cloudminos.jp"
else
    echo "⏳ ALB 正在创建，请稍后运行以下命令查看:"
    echo "   kubectl get ingress costq-fastapi -n $NAMESPACE"
fi

echo ""
echo "============================================================"
echo "✅ 部署完成"
echo "============================================================"
echo ""
echo "查看日志:"
echo "  kubectl logs -f deployment/costq-fastapi -n $NAMESPACE -c app"
echo "  kubectl logs -f deployment/costq-fastapi -n $NAMESPACE -c nginx"
echo ""
echo "查看详细信息:"
echo "  kubectl describe deployment costq-fastapi -n $NAMESPACE"
echo ""
echo "更新 ConfigMap 后重启应用:"
echo "  kubectl apply -f ${K8S_DIR}/configmap.yaml"
echo "  kubectl rollout restart deployment/costq-fastapi -n $NAMESPACE"
echo ""
echo "删除部署:"
echo "  kubectl delete -f ${K8S_DIR}/"
echo ""

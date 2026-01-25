#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Web服务启动入口"""

import sys
import io

# 修复 Windows 控制台编码问题
if sys.platform == "win32":
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8', errors='replace')

from pathlib import Path

import uvicorn
from dotenv import load_dotenv

# 加载环境变量
load_dotenv()

if __name__ == "__main__":
    # 检查前端构建文件是否存在
    frontend_build_path = Path("static/react-build")
    if not frontend_build_path.exists():
        print("警告: 前端构建文件不存在!")
        print("请先运行: cd frontend && npm run build\n")

    print("启动 AWS CostQ Web 服务 (折叠功能分支)...")
    print("访问地址: http://localhost:8000")
    print("按 Ctrl+C 停止服务\n")

    uvicorn.run("backend.main:app", host="0.0.0.0", port=8000, reload=False, log_level="info")

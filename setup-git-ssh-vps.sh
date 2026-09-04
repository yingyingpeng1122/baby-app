#!/bin/bash
# ============================================================
# VPS Git SSH 配置脚本（GitHub push 免密）
# 使用：bash setup-git-ssh-vps.sh
# 适用：Debian/Ubuntu，仓库 yingyingpeng1122/baby-app
# ============================================================
set -e

echo "===== [1/4] 检查是否已存在 SSH key ====="
if [ -f ~/.ssh/id_ed25519.pub ]; then
  echo "已存在 SSH 公钥："
  cat ~/.ssh/id_ed25519.pub
  echo ""
  echo "如果这个 key 已加到 GitHub，可跳到步骤 [3/4] 切换 remote。"
  echo "如果要用新 key，先备份旧的：mv ~/.ssh/id_ed25519 ~/.ssh/id_ed25519.bak"
  read -p "继续生成新 key 覆盖？(y/N) " confirm
  if [ "$confirm" != "y" ] && [ "$confirm" != "Y" ]; then
    echo "已取消。退出。"; exit 0
  fi
fi

echo ""
echo "===== [2/4] 生成 SSH ed25519 key（无密码，自动化友好）====="
ssh-keygen -t ed25519 -C "vps-baby-app" -f ~/.ssh/id_ed25519 -N ""
echo "key 生成完毕。"

echo ""
echo "===== [3/4] 启动 ssh-agent 并加载 key ====="
if [ -z "$SSH_AUTH_SOCK" ]; then
  eval "$(ssh-agent -s)"
fi
ssh-add ~/.ssh/id_ed25519 2>/dev/null || echo "ssh-add 跳过（无 agent 也能用，git 会自动读 ~/.ssh/id_ed25519）"

echo ""
echo "============================================================"
echo "  请把下面这串公钥添加到 GitHub："
echo "  GitHub → Settings → SSH and GPG keys → New SSH key"
echo "  Title 随便填，如 'VPS-baby-app'"
echo "  Key type 选 Authentication Key"
echo "  把下面整行粘贴到 Key 框："
echo "============================================================"
echo ""
cat ~/.ssh/id_ed25519.pub
echo ""
echo "============================================================"
read -p "添加完成？按回车继续（Ctrl+C 取消）..."

echo ""
echo "===== [4/4] 切换 remote 到 SSH 协议并测试 ====="
cd /opt/coding/baby-app
git remote set-url origin git@github.com:yingyingpeng1122/baby-app.git
echo "新 remote："
git remote -v

echo ""
echo "===== 测试 SSH 连接 GitHub ====="
ssh -T -o StrictHostKeyChecking=accept-new git@github.com 2>&1 || true
# 注意：ssh -T 对 github 会返回非 0 退出码但消息是 "Hi xxx! You've successfully authenticated"
# 这是正常的，不是错误

echo ""
echo "===== 验证 push（空推送测试，不改任何东西）====="
cd /opt/coding/baby-app
git push --dry-run origin main 2>&1

echo ""
echo "============================================================"
echo "  ✅ 配置完成！以后在 VPS 上 git push origin main 不再要密码"
echo "  若 SSH 测试报 'Permission denied (publickey)'："
echo "    1) 确认公钥已贴到 GitHub"
echo "    2) 确认 GitHub 账号是 yingyingpeng1122"
echo "    3) 确认 key 类型选了 Authentication Key（不是 Signing Key）"
echo "============================================================"

# BabyFeeder - iOS App

婴儿喂养记录 iOS 应用。

## 构建 IPA 的两种方式

### 方式一：GitHub Actions（推荐）

1. 在 GitHub 创建仓库，push 此文件夹到 main 分支
2. 进入 Actions → Build IPA → Run workflow
3. 等待约 10 分钟，下载生成的 BabyFeeder.ipa
4. 使用 AltStore / SideStore  sideload 到 iPhone

### 方式二：本地 Mac 构建

需要: macOS + Xcode 15+

```bash
# 1. 安装 XcodeGen（如未安装）
brew install xcodegen

# 2. 生成 Xcode 项目
cd baby-feeder-ios
xcodegen

# 3. 用 Xcode 打开 BabyFeeder.xcodeproj
open BabyFeeder.xcodeproj

# 4. 连接 iPhone，选择设备，Cmd+R 运行
```

### 侧载到 iPhone（免费 Apple ID）

1. 下载 AltStore (https://altstore.io) 到 Mac
2. 用数据线连接 iPhone
3. AltStore → 安装 AltStore 到 iPhone
4. iPhone 上打开 AltStore → 侧载 BabyFeeder.ipa
5. 每 7 天需重新侧载一次（免费 Apple ID 限制）

## 功能

- 完全离线运行，所有数据存本地
- 记录喂养类型、奶量、时间
- 统计图表和预测
- 多设备同步（需运行同步服务器）

## 数据同步服务器

见 ../sync-server/ 目录，用 Java 运行：

```bash
cd ../sync-server
java SyncServer
```
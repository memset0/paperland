## MODIFIED Requirements

### Requirement: Desktop top-right function list
在论文详情页的宽屏布局（视口宽度 >= 900px，非 embed），SHALL 在页面**右上角**直接平铺列出所有可用功能的按钮（**不是下拉菜单**，无需先点开再展开）。每个功能按钮 SHALL 显示可识别的图标与名称。当前 SHALL 仅包含"Ask"一个功能。

#### Scenario: Functions listed directly on desktop
- **WHEN** 桌面端用户打开论文详情页
- **THEN** 页面右上角直接显示功能按钮列表，当前仅有"Ask"按钮，无需先点开任何菜单

#### Scenario: Launcher does not obstruct the content
- **WHEN** 功能入口显示在右上角
- **THEN** 入口不遮挡正文阅读，且不与右侧 QA 导航点条（`QAPanelNav`）位置冲突

### Requirement: Mobile circular floating action button
在论文详情页的窄屏布局（视口宽度 < 900px，非 embed）中，功能 SHALL 作为**底部导航栏（mobile bottom bar）中的操作项**出现（当前为"Ask"），header 不再显示功能按钮，也 SHALL NOT 显示圆形悬浮按钮（FAB）。点击底部栏中的功能项即触发该功能。（保留下面两个场景名以兼容历史；FAB 已被底部栏取代。）

#### Scenario: Tap FAB to reveal functions
- **WHEN** 窄屏用户查看论文详情页底部栏
- **THEN** 底部栏中直接显示功能项，当前包含"Ask"，页面上没有圆形悬浮按钮

#### Scenario: Select a function from the FAB list
- **WHEN** 窄屏用户在底部栏中点击"Ask"
- **THEN** 打开提问功能（手机上提问浮窗以全屏浮层显示）

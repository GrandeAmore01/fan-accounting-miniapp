\# DEF-EXP-010 官方渠道缺少官方价格有效性校验



\## 基本信息



\- 缺陷编号：DEF-EXP-010

\- 关联测试用例：TC-EXP-PRICE-010、TC-EXP-PRICE-011

\- 所属模块：消费记录模块

\- 缺陷类型：输入校验 / 官方价格

\- 严重程度：High

\- 优先级：High

\- 当前状态：Open



\## 缺陷描述



选择官方渠道时，系统未验证官方价格是否存在且格式有效。



以下无效数据均被系统接受：



```text

官方价格为空

官方价格为非法字符 abc

```



\## 关联需求



官方渠道输入校验要求：



\- 选择官方渠道时必须选择有效的公共项目。

\- 官方价格为空或格式异常时不能直接提交。

\- 公共价格异常时允许切换为其他渠道并手动输入。



\## 测试方法



等价类划分法。



官方价格有效等价类：



```text

580

80

128.50

```



无效等价类：



```text

空

abc

```



本轮测试选取空值和非法字符进行验证。



\## 测试用例 TC-EXP-PRICE-010



\### 测试条件



```text

category = meet

purchaseChannel = official

officialPrice = ""

amount = 580

```



\### 预期结果



系统拒绝保存。



```text

valid = false

```



\### 实际结果



系统接受该消费。



自动化测试结果：



```text

Expected: false

Received: true

```



\## 测试用例 TC-EXP-PRICE-011



\### 测试条件



```text

category = goods

purchaseChannel = official

officialPrice = abc

amount = 80

quantity = 2

```



\### 预期结果



系统拒绝保存。



```text

valid = false

```



\### 实际结果



系统接受非法官方价格。



自动化测试结果：



```text

Expected: false

Received: true

```



\## 自动化测试



测试文件：



```text

tests/unit/expensePriceMode.test.js

```



执行命令：



```text

npx jest tests/unit/expensePriceMode.test.js --runInBand

```



\## 初步原因分析



当前消费校验未针对官方渠道增加官方价格有效性判断。



校验主要围绕普通 amount 字段执行，因此 officialPrice 为空或格式异常时没有触发错误。



\## 风险



官方价格缺失或异常时仍可生成消费记录。



后续若价格计算改为正式使用 officialPrice，异常数据可能直接造成：



```text

NaN

错误金额

预算统计异常

图表计算异常

```



\## 测试证据



```text

test-evidence/defects/DEF-EXP-010/TC-EXP-PRICE-010\_011\_FAIL\_official-price-validation.png

```



\## 回归测试



待开发修复后重新执行：



```text

TC-EXP-PRICE-010

TC-EXP-PRICE-011

```



验证：



```text

官方价格为空时拒绝

官方价格为非法字符时拒绝

错误提示明确

```



\- 回归状态：Pending




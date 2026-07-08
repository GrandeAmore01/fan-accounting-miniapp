\# DEF-EXP-006 消费城市筛选条件未生效



\## 基本信息



\- 缺陷编号：DEF-EXP-006

\- 关联测试用例：TC-EXP-CITY-001、TC-EXP-CITY-002、TC-EXP-CITY-003、TC-EXP-CITY-004、TC-EXP-CITY-005

\- 所属模块：消费记录模块

\- 缺陷类型：筛选逻辑 / 城市筛选

\- 严重程度：Medium

\- 优先级：High

\- 当前状态：Open



\## 缺陷描述



消费记录城市筛选条件未生效。



传入北京、重庆、上海或不存在的广州等城市筛选条件时，系统仍返回未经过城市过滤的消费记录。



城市条件与关键词组合使用时，关键词筛选生效，但城市条件没有进一步缩小结果范围。



\## 关联需求



城市筛选要求：



\- 支持按城市筛选消费记录。

\- 城市筛选只作用于见面分类。

\- 启用城市筛选后，只显示对应城市的见面消费记录。

\- 非见面消费不参与城市筛选结果。

\- 城市筛选可以与关键词搜索、日期筛选和排序同时使用。

\- 支持清除城市筛选条件。



\## 测试方法



等价类划分法与组合场景测试。



准备以下消费记录：



```text

北京演唱会

category = meet

city = 北京



重庆周年活动

category = meet

city = 重庆



上海购买小卡

category = goods

city = 上海

```



测试有效城市、非见面消费城市、不存在城市以及城市与关键词组合条件。



\## 测试用例 TC-EXP-CITY-001



\### 测试条件



```text

city = 北京

```



\### 预期结果



仅返回：



```text

北京演唱会

```



返回数量：



```text

1

```



\### 实际结果



返回全部 3 条消费记录。



自动化测试结果：



```text

Expected length: 1

Received length: 3

```



\## 测试用例 TC-EXP-CITY-002



\### 测试条件



```text

city = 重庆

```



\### 预期结果



仅返回：



```text

重庆周年活动

```



返回数量：



```text

1

```



\### 实际结果



返回全部 3 条消费记录。



自动化测试结果：



```text

Expected length: 1

Received length: 3

```



\## 测试用例 TC-EXP-CITY-003



\### 测试条件



```text

city = 上海

```



数据中上海消费属于：



```text

category = goods

```



\### 预期结果



城市筛选只作用于见面分类，因此应返回：



```text

0 条

```



\### 实际结果



返回全部 3 条消费记录。



自动化测试结果：



```text

Expected length: 0

Received length: 3

```



\## 测试用例 TC-EXP-CITY-004



\### 测试条件



```text

category = meet

keyword = 见面

city = 重庆

```



关键词“见面”可以匹配两条见面消费。



城市“重庆”应进一步将结果缩小为一条。



\### 预期结果



仅返回：



```text

重庆周年活动

```



返回数量：



```text

1

```



\### 实际结果



返回两条见面消费。



自动化测试结果：



```text

Expected length: 1

Received length: 2

```



该结果表明关键词和分类条件生效，但城市条件未参与进一步筛选。



\## 测试用例 TC-EXP-CITY-005



\### 测试条件



```text

city = 广州

```



测试数据中不存在广州见面消费。



\### 预期结果



返回空列表。



```text

0 条

```



\### 实际结果



返回全部 3 条消费记录。



自动化测试结果：



```text

Expected length: 0

Received length: 3

```



\## 自动化测试



测试文件：



```text

tests/unit/expenseCityFilter.test.js

```



执行命令：



```text

npx jest tests/unit/expenseCityFilter.test.js --runInBand

```



\## 初步原因分析



当前消费筛选逻辑处理了分类和关键词条件，但未根据传入的 city 条件执行城市过滤。



因此：



```text

city = 北京

city = 重庆

city = 上海

city = 广州

```



均未改变筛选结果。



城市与关键词组合筛选时，系统也只执行已有的关键词和分类条件。



\## 风险



用户选择具体城市后仍可能看到其他城市或非见面消费。



城市筛选控件的展示状态与实际数据结果不一致，可能使用户误认为筛选结果可信。



\## 测试证据



```text

test-evidence/defects/DEF-EXP-006/TC-EXP-CITY-001\_FAIL\_beijing-filter.png

```



```text

test-evidence/defects/DEF-EXP-006/TC-EXP-CITY-002\_003\_FAIL\_city-filter-scope.png

```



```text

test-evidence/defects/DEF-EXP-006/TC-EXP-CITY-004\_FAIL\_city-keyword-combination.png

```



```text

test-evidence/defects/DEF-EXP-006/TC-EXP-CITY-005\_FAIL\_no-match-city.png

```



\## 回归测试



待开发修复后重新执行：



```text

TC-EXP-CITY-001

TC-EXP-CITY-002

TC-EXP-CITY-003

TC-EXP-CITY-004

TC-EXP-CITY-005

TC-EXP-CITY-006

```



验证：



```text

北京筛选只显示北京见面消费

重庆筛选只显示重庆见面消费

非见面消费不进入城市筛选结果

城市和关键词条件同时生效

不存在的城市返回空列表

清除城市条件后恢复全部记录

```



\- 回归状态：Pending


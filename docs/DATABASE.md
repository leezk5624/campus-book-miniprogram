# 数据库设计

所有金额字段均以「分」为整数存储。云数据库权限应设置为「所有用户不可读写」，只能通过 `api` 云函数访问。


## users

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `_id` | string | 微信 OpenID |
| `openid` | string | 微信 OpenID，与 `_id` 相同 |
| `nickName` | string | 用户昵称 |
| `avatarUrl` | string | 用户头像地址 |
| `role` | string | `customer` 或 `admin` |
| `enabled` | boolean | 是否允许登录 |
| `createTime` | date | 创建时间 |
| `lastLoginAt` | date | 最近登录时间 |
| `roleUpdatedBy` | string | 最近一次角色调整的操作人 OpenID |

## categories

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `_id` | string | 自动生成 |
| `name` | string | 分类名称，≤12 字 |
| `sort` | number | 排序值，越小越靠前 |
| `enabled` | boolean | 是否在前台显示 |
| `deleted` | boolean | 删除标记（软删除） |
| `createTime` | date | 创建时间 |
| `updateTime` | date | 更新时间 |

## books（图书）

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `_id` | string | 自动生成 |
| `categoryId` | string | 关联 `categories._id`，保存时校验必须存在 |
| `name` | string | 书名，≤60 字，必填 |
| `author` | string | 作者，≤40 字 |
| `publisher` | string | 出版社，≤60 字 |
| `isbn` | string | ISBN，10~17 位数字/X/- |
| `publishYear` | number | 出版年份，0 表示未填 |
| `pages` | number | 页数，0 表示未填 |
| `description` | string | 一句话简介，≤200 字，列表页展示 |
| `intro` | string | 详细介绍，≤2000 字，支持换行分段，仅详情接口返回 |
| `tags` | array | 标签，最多 8 个，每个 ≤12 字 |
| `location` | string | 馆藏位置，≤40 字 |
| `price` | number | 定价，单位分 |
| `originalPrice` | number | 划线价，单位分，0 表示不显示 |
| `stock` | number | 馆藏数量，-1 表示不限 |
| `sales` | number | 累计借阅次数 |
| `enabled` | boolean | 是否上架 |
| `recommended` | boolean | 是否推荐 |
| `image` | string | 封面：云存储 fileID 或 https 图片地址；空则使用 emoji |
| `emoji` | string | 无封面时的回退图标 |
| `sort` | number | 排序值，越小越靠前 |
| `deleted` | boolean | 删除标记（软删除） |
| `createBy` / `updateBy` | string | 创建/最后修改人 OpenID |
| `createTime` | date | 创建时间 |
| `updateTime` | date | 更新时间 |

### 列表接口字段投影

`getMenu` / `listBooks` 只返回：

```text
categoryId, name, author, publisher, isbn, description, price, originalPrice,
stock, sales, enabled, recommended, image, emoji, sort, updateTime
```

`intro`、`tags`、`location`、`pages`、`publishYear` 仅在 `getBook`（单本详情）返回，
避免列表页因长文本造成传输与渲染开销。

## settings

固定使用文档 ID `library`。

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `libraryName` | string | 图书馆名称 |
| `notice` | string | 公告 |
| `address` | string | 地址 |
| `phone` | string | 联系电话 |
| `openHours` | string | 开放时间 |
| `createTime` | date | 创建时间 |
| `updateTime` | date | 更新时间 |

## 一致性与安全约束

- 所有写操作在云函数内重新鉴权，不接受客户端传入的角色或金额。
- 保存图书时校验分类存在且未删除，避免产生孤儿数据。
- 删除图书为软删除，同时清空 `image` 并删除对应云存储文件。
- 更换封面后删除旧云文件，减少存储占用。
- 列表更新上下架状态使用 `setBookStatus` 单字段更新，避免用列表数据整体覆盖导致简介等字段被清空。
- 复制图书时封面会复制成新的云文件，避免与原书共享同一文件。
- 已被删除的图书不会出现在任何前台接口中。

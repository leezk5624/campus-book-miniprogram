'use strict';

// 示例数据。分类种子必须带 deleted / enabled：早期版本漏了这两个字段，
// 配上等值查询，结果就是数据写进去了、前台却一条都查不到。

const { DEFAULT_SETTINGS } = require('./constants');

function createSeedService(options) {
  const db = options.db;
  const _ = options._;
  const store = options.store;
  const collections = options.collections;

  async function seedDefaultData(force) {
    if (force) {
      await store.clearCollection(collections.books);
      await store.clearCollection(collections.categories);
      await store.writeCollection(collections.settings, (col) => col.doc('library').set({
        data: Object.assign({}, DEFAULT_SETTINGS, {
          createTime: db.serverDate(),
          updateTime: db.serverDate()
        })
      }));
    }
    const total = await store.countWhere(collections.categories, { deleted: _.neq(true) });
    if (total > 0) return { seeded: false };

    const categorySeeds = [
      { name: '文学小说', sort: 1 },
      { name: '科学技术', sort: 2 },
      { name: '教材教辅', sort: 3 }
    ];
    // 种子之间没有依赖，并发写入。
    const results = await Promise.all(categorySeeds.map((item) => store.writeCollection(
      collections.categories,
      (col) => col.add({
        data: Object.assign({}, item, {
          enabled: true,
          deleted: false,
          createTime: db.serverDate(),
          updateTime: db.serverDate()
        })
      })
    )));
    const ids = results.map((result) => result._id);

    const bookSeeds = buildBookSeeds(ids);
    await Promise.all(bookSeeds.map((item) => store.writeCollection(
      collections.books,
      (col) => col.add({
        data: Object.assign({}, item, { deleted: false, createTime: db.serverDate(), updateTime: db.serverDate() })
      })
    )));
    return { seeded: true, categories: categorySeeds.length, books: bookSeeds.length };
  }

  return { seedDefaultData };
}

function buildBookSeeds(ids) {
  return [
    {
      categoryId: ids[0], name: '活着', author: '余华', publisher: '作家出版社', isbn: '9787506365437',
      publishYear: 2012, pages: 191, price: 3500, originalPrice: 4500, stock: 3, sales: 12,
      description: '余华代表作，讲述普通人在时代中的坚韧与温情',
      intro: '《活着》讲述了农村人福贵悲惨的人生遭遇。福贵本是个阔少爷，因嗜赌输光家产，此后历经战乱、饥荒与亲人离散。小说以平静的叙述写出生命的承受力，是余华最具代表性的作品之一。',
      tags: ['当代文学', '长篇小说'], location: 'A区-01-03', enabled: true, recommended: true, image: '', emoji: '📕', sort: 1
    },
    {
      categoryId: ids[0], name: '平凡的世界', author: '路遥', publisher: '北京十月文艺出版社', isbn: '9787530216781',
      publishYear: 2017, pages: 1631, price: 9800, originalPrice: 0, stock: 2, sales: 8,
      description: '路遥长篇小说，描写普通人的奋斗与生活',
      intro: '以孙少安、孙少平兄弟为中心，全景式描写中国当代城乡社会生活。作品在平凡人物的奋斗中呈现时代变迁，被誉为茅盾文学奖中的经典之作。',
      tags: ['当代文学', '茅盾文学奖'], location: 'A区-01-05', enabled: true, recommended: true, image: '', emoji: '📗', sort: 2
    },
    {
      categoryId: ids[0], name: '围城', author: '钱钟书', publisher: '人民文学出版社', isbn: '9787020090006',
      publishYear: 1991, pages: 359, price: 3200, originalPrice: 0, stock: 4, sales: 5,
      description: '钱钟书经典小说，语言幽默犀利',
      intro: '以方鸿渐的求学、谋职与婚姻为主线，描绘抗战初期知识分子的众生相。比喻精妙、讽刺犀利，“城外的人想进去，城里的人想出来”流传甚广。',
      tags: ['现代文学', '讽刺小说'], location: 'A区-02-01', enabled: true, recommended: false, image: '', emoji: '📙', sort: 3
    },
    {
      categoryId: ids[1], name: '时间简史', author: '史蒂芬·霍金', publisher: '湖南科学技术出版社', isbn: '9787535732309',
      publishYear: 2010, pages: 236, price: 4500, originalPrice: 0, stock: 5, sales: 9,
      description: '霍金科普经典，带你认识宇宙的奥秘',
      intro: '从大爆炸到黑洞，霍金用通俗的语言介绍宇宙的起源与命运，是现代物理学最畅销的科普读物之一。',
      tags: ['科普', '物理学'], location: 'B区-03-02', enabled: true, recommended: true, image: '', emoji: '📘', sort: 1
    },
    {
      categoryId: ids[1], name: '人类简史', author: '尤瓦尔·赫拉利', publisher: '中信出版社', isbn: '9787508647357',
      publishYear: 2014, pages: 440, price: 6800, originalPrice: 0, stock: 4, sales: 7,
      description: '从认知革命到科技革命，重新理解人类文明',
      intro: '以认知革命、农业革命、科学革命三条主线重构人类历史，提出许多富有争议却极具启发性的观点。',
      tags: ['历史', '社会科学'], location: 'B区-04-01', enabled: true, recommended: false, image: '', emoji: '📔', sort: 2
    },
    {
      categoryId: ids[1], name: '深入理解计算机系统', author: 'Randal E. Bryant', publisher: '机械工业出版社', isbn: '9787111544937',
      publishYear: 2016, pages: 737, price: 12800, originalPrice: 0, stock: 2, sales: 4,
      description: '计算机专业经典教材，讲解底层原理',
      intro: '从程序员视角讲解计算机系统：数据表示、汇编、处理器、存储层次、链接、异常控制流、虚拟内存与并发编程，是理解系统底层的重要教材。',
      tags: ['计算机', '教材'], location: 'C区-01-01', enabled: true, recommended: false, image: '', emoji: '💻', sort: 3
    },
    {
      categoryId: ids[2], name: '高等数学（上册）', author: '同济大学数学系', publisher: '高等教育出版社', isbn: '9787040396638',
      publishYear: 2014, pages: 423, price: 4200, originalPrice: 0, stock: 20, sales: 15,
      description: '理工科通用教材，配套习题丰富',
      intro: '内容包括函数与极限、导数与微分、微分中值定理与导数应用、不定积分、定积分及其应用、微分方程等，配套习题量大。',
      tags: ['数学', '教材'], location: 'C区-02-04', enabled: true, recommended: true, image: '', emoji: '📐', sort: 1
    },
    {
      categoryId: ids[2], name: '大学英语四级真题', author: '新东方考试研究中心', publisher: '浙江教育出版社', isbn: '9787553681254',
      publishYear: 2020, pages: 320, price: 3600, originalPrice: 0, stock: 15, sales: 11,
      description: '历年真题汇编，备考必备',
      intro: '收录历年大学英语四级考试真题及解析，按题型分类训练，适合备考阶段集中练习。',
      tags: ['英语', '考试'], location: 'C区-03-02', enabled: true, recommended: false, image: '', emoji: '📝', sort: 2
    }
  ];
}

module.exports = { createSeedService };

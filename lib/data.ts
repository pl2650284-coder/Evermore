'use client';

import { useEffect, useState } from 'react';
import { useCouple } from './couple';
import {
  timelineApi,
  wishlistApi,
  photosApi,
  capsulesApi,
  achievementsApi,
  lettersApi,
  giftsApi,
  ticketsApi,
  TimelineEvent,
  WishlistItem,
  Photo,
  TimeCapsule,
  Achievement,
  AchievementInput,
  Letter,
  Gift,
  Ticket,
  Tag,
} from './api';

// ========== 时间轴 ==========
export function useTimelineEvents() {
  const { couple } = useCouple();
  const [events, setEvents] = useState<TimelineEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchEvents = async () => {
    if (!couple) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const result = await timelineApi.getEvents();
      setEvents(result.events || []);
    } catch (err) {
      console.error('[fetchEvents] 获取失败:', err);
      setError(err instanceof Error ? err.message : '获取数据失败');
    } finally {
      setLoading(false);
    }
  };

  const addEvent = async (event: any) => {
    if (!couple) throw new Error('No couple');
    const result = await timelineApi.createEvent(event);
    setEvents(prev => [result.event, ...prev]);
    return result.event;
  };

  const updateEvent = async (id: string, updates: any) => {
    if (!couple) throw new Error('No couple');
    const result = await timelineApi.updateEvent(id, updates);
    setEvents(prev => prev.map(e => e.id === id ? result.event : e));
    return result.event;
  };

  const deleteEvent = async (id: string) => {
    if (!couple) throw new Error('No couple');
    await timelineApi.deleteEvent(id);
    setEvents(prev => prev.filter(e => e.id !== id));
  };

  useEffect(() => { fetchEvents(); }, [couple]);

  return { events, loading, error, addEvent, updateEvent, deleteEvent, refresh: fetchEvents };
}

// ========== 愿望清单 ==========
export function useWishlist() {
  const { couple } = useCouple();
  const [wishlists, setWishlists] = useState<WishlistItem[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchItems = async () => {
    if (!couple) { setLoading(false); return; }
    setLoading(true);
    try {
      const result = await wishlistApi.getItems();
      setWishlists(result.items || []);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  const addItem = async (item: any) => {
    if (!couple) throw new Error('No couple');
    const result = await wishlistApi.createItem(item);
    setWishlists(prev => [result.item, ...prev]);
    return result.item;
  };

  const updateItem = async (id: string, updates: any) => {
    if (!couple) throw new Error('No couple');
    const result = await wishlistApi.updateItem(id, updates);
    setWishlists(prev => prev.map(i => i.id === id ? result.item : i));
    return result.item;
  };

  const deleteItem = async (id: string) => {
    if (!couple) throw new Error('No couple');
    await wishlistApi.deleteItem(id);
    setWishlists(prev => prev.filter(i => i.id !== id));
  };

  useEffect(() => { fetchItems(); }, [couple]);

  return { wishlists, items: wishlists, loading, addItem, updateItem, deleteItem, refresh: fetchItems };
}

// ========== 照片 ==========
export function usePhotos() {
  const { couple } = useCouple();
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchPhotos = async () => {
    if (!couple) { setLoading(false); return; }
    setLoading(true);
    try {
      const result = await photosApi.getPhotos();
      // 转换字段名：url -> image_url (前端期望的格式)
      const photosWithImageUrl = (result.photos || []).map((p: any) => ({
        ...p,
        image_url: p.url,
      }));
      setPhotos(photosWithImageUrl);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  const addPhoto = async (photo: any, tagIds?: string[]) => {
    if (!couple) throw new Error('No couple');
    // 转换字段名：image_url -> url (后端期望的格式)
    const { image_url, location, ...rest } = photo;
    const photoData = {
      ...rest,
      url: image_url,
      location: location || null,
      tagIds,
    };
    const result = await photosApi.createPhoto(photoData);
    await fetchPhotos();
    return result.photo;
  };

  useEffect(() => { fetchPhotos(); }, [couple]);

  return { photos, loading, addPhoto, refresh: fetchPhotos };
}

// ========== 时光胶囊 ==========
export function useTimeCapsules() {
  const { couple } = useCouple();
  const [capsules, setCapsules] = useState<TimeCapsule[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchCapsules = async () => {
    if (!couple) { setLoading(false); return; }
    setLoading(true);
    try {
      const result = await capsulesApi.getCapsules();
      setCapsules(result.capsules || []);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  const addCapsule = async (capsule: any) => {
    if (!couple) throw new Error('No couple');
    const result = await capsulesApi.createCapsule(capsule);
    setCapsules(prev => [result.capsule, ...prev]);
    return result.capsule;
  };

  const updateCapsule = async (id: string, updates: any) => {
    if (!couple) throw new Error('No couple');
    const result = await capsulesApi.updateCapsule(id, updates);
    setCapsules(prev => prev.map(c => c.id === id ? result.capsule : c));
    return result.capsule;
  };

  const deleteCapsule = async (id: string) => {
    if (!couple) throw new Error('No couple');
    await capsulesApi.deleteCapsule(id);
    setCapsules(prev => prev.filter(c => c.id !== id));
  };

  useEffect(() => { fetchCapsules(); }, [couple]);

  return { capsules, loading, addCapsule, updateCapsule, deleteCapsule, refresh: fetchCapsules };
}

// ========== 成就系统 ==========
// 预定义的成就模板
export const ACHIEVEMENT_TEMPLATES = [
  { id: 'first_photo', title: '第一张照片', description: '上传第一张照片', icon: '📷' },
  { id: 'first_event', title: '第一个纪念日', description: '添加第一个时间线事件', icon: '🎉' },
  { id: 'first_letter', title: '第一封信', description: '写下第一封信', icon: '💌' },
  { id: 'first_gift', title: '第一份礼物', description: '记录第一份礼物', icon: '🎁' },
  { id: 'first_ticket', title: '第一张票根', description: '收藏第一张票据', icon: '🎫' },
  { id: 'first_wish', title: '第一个愿望', description: '添加第一个愿望清单', icon: '⭐' },
  { id: 'ten_photos', title: '照片收集者', description: '上传10张照片', icon: '📸' },
  { id: 'fifty_photos', title: '摄影大师', description: '上传50张照片', icon: '🖼️' },
  { id: 'five_events', title: '回忆收藏家', description: '添加5个时间线事件', icon: '📅' },
  { id: 'first_capsule', title: '时间旅行者', description: '创建第一个时光胶囊', icon: '⏰' },
  { id: 'together_30', title: '一个月', description: '在一起30天', icon: '💕' },
  { id: 'together_100', title: '百日纪念', description: '在一起100天', icon: '💯' },
  { id: 'together_365', title: '一周年', description: '在一起365天', icon: '🎊' },
  { id: 'together_730', title: '两周年', description: '在一起730天', icon: '🌈' },
];

export function useAchievements() {
  const { couple } = useCouple();
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAchievements = async () => {
    if (!couple) { setAchievements([]); setLoading(false); return; }
    setLoading(true);
    setError(null);
    try {
      const result = await achievementsApi.getAchievements();
      setAchievements(result.achievements || []);
    } catch (e) { setError(e instanceof Error ? e.message : '获取成就失败'); }
    finally { setLoading(false); }
  };

  const addAchievement = async (data: AchievementInput) => {
    const result = await achievementsApi.createAchievement(data);
    setAchievements(prev => [result.achievement, ...prev]);
    return result.achievement;
  };

  const updateAchievement = async (id: string, data: Partial<AchievementInput> & { unlocked?: boolean }) => {
    const result = await achievementsApi.updateAchievement(id, data);
    setAchievements(prev => prev.map(item => item.id === id ? result.achievement : item));
    return result.achievement;
  };

  const deleteAchievement = async (id: string) => {
    await achievementsApi.deleteAchievement(id);
    setAchievements(prev => prev.filter(item => item.id !== id));
  };

  const unlockAchievement = async (title: string) => {
    if (!couple) throw new Error('No couple');
    const template = ACHIEVEMENT_TEMPLATES.find(item => item.title === title);
    if (!template) throw new Error('未找到成就模板');
    const result = await achievementsApi.unlockAchievement({ ...template, achievement_type: template.id });
    setAchievements(prev => [result.achievement, ...prev]);
    return result.achievement;
  };

  const achievementsWithStatus = ACHIEVEMENT_TEMPLATES.map(template => {
    const unlocked = achievements.find(a => !a.is_custom && (a.achievement_type === template.id || a.title === template.title));
    return {
      ...template,
      unlocked: !!unlocked,
      unlockedAt: unlocked?.unlocked_at,
      progress: unlocked ? 1 : 0,
      maxProgress: 1,
    };
  });

  useEffect(() => { fetchAchievements(); }, [couple]);

  return {
    achievements, loading, error, addAchievement, updateAchievement, deleteAchievement,
    unlockAchievement, checkAndUnlockAchievements: async () => {}, achievementsWithStatus,
    customAchievements: achievements.filter(item => item.is_custom), refresh: fetchAchievements,
  };
}

// ========== 信件馆 ==========
export function useLetters() {
  const { couple } = useCouple();
  const [letters, setLetters] = useState<Letter[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchLetters = async () => {
    if (!couple) { setLoading(false); return; }
    setLoading(true);
    try {
      const result = await lettersApi.getLetters();
      setLetters(result.letters || []);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  const addLetter = async (letter: any) => {
    if (!couple) throw new Error('No couple');
    const result = await lettersApi.createLetter(letter);
    setLetters(prev => [result.letter, ...prev]);
    return result.letter;
  };

  const updateLetter = async (id: string, updates: any) => {
    if (!couple) throw new Error('No couple');
    const result = await lettersApi.updateLetter(id, updates);
    setLetters(prev => prev.map(l => l.id === id ? result.letter : l));
    return result.letter;
  };

  const deleteLetter = async (id: string) => {
    if (!couple) throw new Error('No couple');
    await lettersApi.deleteLetter(id);
    setLetters(prev => prev.filter(l => l.id !== id));
  };

  useEffect(() => { fetchLetters(); }, [couple]);

  return { letters, loading, addLetter, updateLetter, deleteLetter, refresh: fetchLetters };
}

// ========== 礼物馆 ==========
export function useGifts() {
  const { couple } = useCouple();
  const [gifts, setGifts] = useState<Gift[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchGifts = async () => {
    if (!couple) { setLoading(false); return; }
    setLoading(true);
    try {
      const result = await giftsApi.getGifts();
      setGifts(result.gifts || []);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  const addGift = async (gift: any) => {
    if (!couple) throw new Error('No couple');
    const result = await giftsApi.createGift(gift);
    setGifts(prev => [result.gift, ...prev]);
    return result.gift;
  };

  const updateGift = async (id: string, updates: any) => {
    if (!couple) throw new Error('No couple');
    const result = await giftsApi.updateGift(id, updates);
    setGifts(prev => prev.map(g => g.id === id ? result.gift : g));
    return result.gift;
  };

  const deleteGift = async (id: string) => {
    if (!couple) throw new Error('No couple');
    await giftsApi.deleteGift(id);
    setGifts(prev => prev.filter(g => g.id !== id));
  };

  useEffect(() => { fetchGifts(); }, [couple]);

  return { gifts, loading, addGift, updateGift, deleteGift, refresh: fetchGifts };
}

// ========== 门票馆 ==========
export function useTickets() {
  const { couple } = useCouple();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchTickets = async () => {
    if (!couple) { setLoading(false); return; }
    setLoading(true);
    try {
      const result = await ticketsApi.getTickets();
      setTickets(result.tickets || []);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  const addTicket = async (ticket: any) => {
    if (!couple) throw new Error('No couple');
    const result = await ticketsApi.createTicket(ticket);
    setTickets(prev => [result.ticket, ...prev]);
    return result.ticket;
  };

  const updateTicket = async (id: string, updates: any) => {
    if (!couple) throw new Error('No couple');
    const result = await ticketsApi.updateTicket(id, updates);
    setTickets(prev => prev.map(t => t.id === id ? result.ticket : t));
    return result.ticket;
  };

  const deleteTicket = async (id: string) => {
    if (!couple) throw new Error('No couple');
    await ticketsApi.deleteTicket(id);
    setTickets(prev => prev.filter(t => t.id !== id));
  };

  useEffect(() => { fetchTickets(); }, [couple]);

  return { tickets, loading, addTicket, updateTicket, deleteTicket, refresh: fetchTickets };
}

// ========== 标签管理 ==========
export function useTags() {
  const { couple } = useCouple();
  const [tags, setTags] = useState<Tag[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchTags = async () => {
    if (!couple) return;
    setLoading(true);
    try {
      const result = await photosApi.getTags();
      setTags(result.tags || []);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  const addTag = async (name: string) => {
    if (!couple) throw new Error('No couple');
    const result = await photosApi.createTag(name);
    setTags(prev => [result.tag, ...prev]);
    return result.tag;
  };

  useEffect(() => { fetchTags(); }, [couple]);

  return { tags, loading, addTag, refresh: fetchTags };
}

// ========== 省市区数据 ==========
// 简化版中国行政区划数据
export const PROVINCES = [
  '陕西省', '北京市', '上海市', '天津市', '重庆市', '河北省', '山西省', '辽宁省', '吉林省', '黑龙江省',
  '江苏省', '浙江省', '安徽省', '福建省', '江西省', '山东省', '河南省', '湖北省', '湖南省', '广东省',
  '海南省', '四川省', '贵州省', '云南省', '甘肃省', '青海省', '台湾省', '内蒙古自治区', '广西壮族自治区',
  '西藏自治区', '宁夏回族自治区', '新疆维吾尔自治区', '香港特别行政区', '澳门特别行政区'
];

// 各省份城市数据（省会+主要城市）
export const CITIES: Record<string, string[]> = {
  '陕西省': ['西安市', '宝鸡市', '咸阳市', '铜川市', '渭南市', '延安市', '榆林市', '汉中市', '安康市', '商洛市'],
  '北京市': ['北京市'],
  '上海市': ['上海市'],
  '天津市': ['天津市'],
  '重庆市': ['重庆市', '万州区', '涪陵区', '渝中区', '江北区', '沙坪坝区', '九龙坡区', '南岸区', '北碚区', '綦江区', '大足区', '渝北区', '巴南区', '黔江区', '长寿区', '江津区', '合川区', '永川区', '南川区'],
  '河北省': ['石家庄市', '唐山市', '秦皇岛市', '邯郸市', '邢台市', '保定市', '张家口市', '承德市', '沧州市', '廊坊市', '衡水市'],
  '山西省': ['太原市', '大同市', '阳泉市', '长治市', '晋城市', '朔州市', '晋中市', '运城市', '忻州市', '临汾市', '吕梁市'],
  '辽宁省': ['沈阳市', '大连市', '鞍山市', '抚顺市', '本溪市', '丹东市', '锦州市', '营口市', '阜新市', '辽阳市', '盘锦市', '铁岭市', '朝阳市', '葫芦岛市'],
  '吉林省': ['长春市', '吉林市', '四平市', '辽源市', '通化市', '白山市', '松原市', '白城市', '延边朝鲜族自治州'],
  '黑龙江省': ['哈尔滨市', '齐齐哈尔市', '鸡西市', '鹤岗市', '双鸭山市', '大庆市', '伊春市', '佳木斯市', '七台河市', '牡丹江市', '黑河市', '绥化市'],
  '江苏省': ['南京市', '无锡市', '徐州市', '常州市', '苏州市', '南通市', '连云港市', '淮安市', '盐城市', '扬州市', '镇江市', '泰州市', '宿迁市'],
  '浙江省': ['杭州市', '宁波市', '温州市', '嘉兴市', '湖州市', '绍兴市', '金华市', '衢州市', '舟山市', '台州市', '丽水市'],
  '安徽省': ['合肥市', '芜湖市', '蚌埠市', '淮南市', '马鞍山市', '淮北市', '铜陵市', '安庆市', '黄山市', '滁州市', '阜阳市', '宿州市', '六安市', '亳州市', '池州市', '宣城市'],
  '福建省': ['福州市', '厦门市', '莆田市', '三明市', '泉州市', '漳州市', '南平市', '龙岩市', '宁德市'],
  '江西省': ['南昌市', '景德镇市', '萍乡市', '九江市', '新余市', '鹰潭市', '赣州市', '吉安市', '宜春市', '抚州市', '上饶市'],
  '山东省': ['济南市', '青岛市', '淄博市', '枣庄市', '东营市', '烟台市', '潍坊市', '济宁市', '泰安市', '威海市', '日照市', '临沂市', '德州市', '聊城市', '滨州市', '菏泽市'],
  '河南省': ['郑州市', '开封市', '洛阳市', '平顶山市', '安阳市', '鹤壁市', '新乡市', '焦作市', '濮阳市', '许昌市', '漯河市', '三门峡市', '南阳市', '商丘市', '信阳市', '周口市', '驻马店市'],
  '湖北省': ['武汉市', '黄石市', '十堰市', '宜昌市', '襄阳市', '鄂州市', '荆门市', '孝感市', '荆州市', '黄冈市', '咸宁市', '随州市', '恩施土家族苗族自治州'],
  '湖南省': ['长沙市', '株洲市', '湘潭市', '衡阳市', '邵阳市', '岳阳市', '常德市', '张家界市', '益阳市', '郴州市', '永州市', '怀化市', '娄底市', '湘西土家族苗族自治州'],
  '广东省': ['广州市', '韶关市', '深圳市', '珠海市', '汕头市', '佛山市', '江门市', '湛江市', '茂名市', '肇庆市', '惠州市', '梅州市', '汕尾市', '河源市', '阳江市', '清远市', '东莞市', '中山市', '潮州市', '揭阳市', '云浮市'],
  '海南省': ['海口市', '三亚市', '三沙市', '儋州市'],
  '四川省': ['成都市', '自贡市', '攀枝花市', '泸州市', '德阳市', '绵阳市', '广元市', '遂宁市', '内江市', '乐山市', '南充市', '眉山市', '宜宾市', '广安市', '达州市', '雅安市', '巴中市', '资阳市', '阿坝藏族羌族自治州', '甘孜藏族自治州', '凉山彝族自治州'],
  '贵州省': ['贵阳市', '六盘水市', '遵义市', '安顺市', '毕节市', '铜仁市', '黔西南布依族苗族自治州', '黔东南苗族侗族自治州', '黔南布依族苗族自治州'],
  '云南省': ['昆明市', '曲靖市', '玉溪市', '保山市', '昭通市', '丽江市', '普洱市', '临沧市', '楚雄彝族自治州', '红河哈尼族彝族自治州', '文山壮族苗族自治州', '西双版纳傣族自治州', '大理白族自治州', '德宏傣族景颇族自治州', '怒江傈僳族自治州', '迪庆藏族自治州'],
  '甘肃省': ['兰州市', '嘉峪关市', '金昌市', '白银市', '天水市', '武威市', '张掖市', '平凉市', '酒泉市', '庆阳市', '定西市', '陇南市', '临夏回族自治州', '甘南藏族自治州'],
  '青海省': ['西宁市', '海东市', '海北藏族自治州', '黄南藏族自治州', '海南藏族自治州', '果洛藏族自治州', '玉树藏族自治州', '海西蒙古族藏族自治州'],
  '台湾省': ['台北市', '新北市', '桃园市', '台中市', '台南市', '高雄市', '基隆市', '新竹市', '嘉义市'],
  '内蒙古自治区': ['呼和浩特市', '包头市', '乌海市', '赤峰市', '通辽市', '鄂尔多斯市', '呼伦贝尔市', '巴彦淖尔市', '乌兰察布市', '兴安盟', '锡林郭勒盟', '阿拉善盟'],
  '广西壮族自治区': ['南宁市', '柳州市', '桂林市', '梧州市', '北海市', '防城港市', '钦州市', '贵港市', '玉林市', '百色市', '贺州市', '河池市', '来宾市', '崇左市'],
  '西藏自治区': ['拉萨市', '日喀则市', '昌都市', '林芝市', '山南市', '那曲市', '阿里地区'],
  '宁夏回族自治区': ['银川市', '石嘴山市', '吴忠市', '固原市', '中卫市'],
  '新疆维吾尔自治区': ['乌鲁木齐市', '克拉玛依市', '吐鲁番市', '哈密市', '昌吉回族自治州', '博尔塔拉蒙古自治州', '巴音郭楞蒙古自治州', '阿克苏地区', '克孜勒苏柯尔克孜自治州', '喀什地区', '和田地区', '伊犁哈萨克自治州', '塔城地区', '阿勒泰地区'],
  '香港特别行政区': ['香港特别行政区'],
  '澳门特别行政区': ['澳门特别行政区']
};

// 各城市区县数据（简化版）
export const DISTRICTS: Record<string, string[]> = {
  // 陕西省所有城市
  '西安市': ['周至县', '长安区', '雁塔区', '新城区', '碑林区', '莲湖区', '灞桥区', '未央区', '阎良区', '临潼区', '高陵区', '鄠邑区', '蓝田县'],
  '宝鸡市': ['渭滨区', '金台区', '陈仓区', '凤翔区', '岐山县', '扶风县', '眉县', '陇县', '千阳县', '麟游县', '凤县', '太白县'],
  '咸阳市': ['秦都区', '杨陵区', '渭城区', '兴平市', '彬州市', '三原县', '泾阳县', '乾县', '礼泉县', '永寿县', '长武县', '旬邑县', '淳化县', '武功县'],
  '铜川市': ['王益区', '印台区', '耀州区', '宜君县'],
  '渭南市': ['临渭区', '华州区', '韩城市', '华阴市', '潼关县', '大荔县', '合阳县', '澄城县', '蒲城县', '白水县', '富平县'],
  '延安市': ['宝塔区', '安塞区', '子长市', '延长县', '延川县', '志丹县', '吴起县', '甘泉县', '富县', '洛川县', '宜川县', '黄龙县', '黄陵县'],
  '榆林市': ['榆阳区', '横山区', '神木市', '府谷县', '靖边县', '定边县', '绥德县', '米脂县', '佳县', '吴堡县', '清涧县', '子洲县'],
  '汉中市': ['汉台区', '南郑区', '城固县', '洋县', '西乡县', '勉县', '宁强县', '略阳县', '镇巴县', '留坝县', '佛坪县'],
  '安康市': ['汉滨区', '汉阴县', '石泉县', '宁陕县', '紫阳县', '岚皋县', '平利县', '镇坪县', '旬阳县', '白河县'],
  '商洛市': ['商州区', '洛南县', '丹凤县', '商南县', '山阳县', '镇安县', '柞水县'],
  // 直辖市
  '北京市': ['东城区', '西城区', '朝阳区', '丰台区', '石景山区', '海淀区', '顺义区', '通州区', '大兴区', '房山区', '门头沟区', '昌平区', '平谷区', '密云区', '怀柔区', '延庆区'],
  '上海市': ['黄浦区', '徐汇区', '长宁区', '静安区', '普陀区', '虹口区', '杨浦区', '浦东新区', '闵行区', '宝山区', '嘉定区', '金山区', '松江区', '青浦区', '奉贤区', '崇明区'],
  '天津市': ['和平区', '河东区', '河西区', '南开区', '河北区', '红桥区', '东丽区', '西青区', '津南区', '北辰区', '武清区', '宝坻区', '滨海新区', '宁河区', '静海区', '蓟州区'],
  '重庆市': ['万州区', '涪陵区', '渝中区', '大渡口区', '江北区', '沙坪坝区', '九龙坡区', '南岸区', '北碚区', '綦江区', '大足区', '渝北区', '巴南区', '黔江区', '长寿区', '江津区', '合川区', '永川区', '南川区'],
  // 广东省
  '广州市': ['越秀区', '海珠区', '荔湾区', '天河区', '白云区', '黄埔区', '番禺区', '花都区', '南沙区', '从化区', '增城区'],
  '深圳市': ['罗湖区', '福田区', '南山区', '宝安区', '龙岗区', '盐田区', '龙华区', '坪山区', '光明区', '大鹏新区'],
  '佛山市': ['禅城区', '南海区', '顺德区', '三水区', '高明区'],
  '东莞市': ['莞城区', '南城区', '东城区', '万江区', '虎门镇', '长安镇', '厚街镇', '大朗镇', '常平镇'],
  '中山市': ['石岐区', '东区', '西区', '南区', '五桂山区', '火炬开发区'],
  '珠海市': ['香洲区', '斗门区', '金湾区'],
  '汕头市': ['金平区', '龙湖区', '濠江区', '潮阳区', '潮南区', '澄海区', '南澳县'],
  '湛江市': ['赤坎区', '霞山区', '坡头区', '麻章区', '遂溪县', '徐闻县', '廉江市', '雷州市', '吴川市'],
  '江门市': ['蓬江区', '江海区', '新会区', '台山市', '开平市', '鹤山市', '恩平市'],
  // 江苏省
  '南京市': ['玄武区', '秦淮区', '建邺区', '鼓楼区', '浦口区', '栖霞区', '雨花台区', '江宁区', '六合区', '溧水区', '高淳区'],
  '苏州市': ['姑苏区', '虎丘区', '吴中区', '相城区', '吴江区', '昆山市', '常熟市', '张家港市', '太仓市'],
  '无锡市': ['梁溪区', '锡山区', '惠山区', '滨湖区', '新吴区', '江阴市', '宜兴市'],
  '常州市': ['天宁区', '钟楼区', '新北区', '武进区', '金坛区', '溧阳市'],
  '徐州市': ['云龙区', '鼓楼区', '贾汪区', '泉山区', '铜山区', '丰县', '沛县', '睢宁县', '邳州市', '新沂市'],
  '南通市': ['崇川区', '通州区', '海门区', '如东县', '启东市', '如皋市', '海安市'],
  // 浙江省
  '杭州市': ['上城区', '拱墅区', '西湖区', '滨江区', '萧山区', '余杭区', '临平区', '钱塘区', '富阳区', '临安区', '桐庐县', '淳安县', '建德市'],
  '宁波市': ['海曙区', '江北区', '北仑区', '镇海区', '鄞州区', '奉化区', '象山县', '宁海县', '余姚市', '慈溪市'],
  '温州市': ['鹿城区', '龙湾区', '瓯海区', '洞头区', '永嘉县', '平阳县', '苍南县', '文成县', '泰顺县', '瑞安市', '乐清市', '龙港市'],
  '嘉兴市': ['南湖区', '秀洲区', '嘉善县', '海盐县', '海宁市', '平湖市', '桐乡市'],
  '绍兴市': ['越城区', '柯桥区', '上虞区', '新昌县', '诸暨市', '嵊州市'],
  '金华市': ['婺城区', '金东区', '武义县', '浦江县', '磐安县', '兰溪市', '义乌市', '东阳市', '永康市'],
  // 四川省
  '成都市': ['锦江区', '青羊区', '金牛区', '武侯区', '成华区', '龙泉驿区', '青白江区', '新都区', '温江区', '双流区', '郫都区', '新津区', '金堂县', '大邑县', '蒲江县', '都江堰市', '彭州市', '邛崃市', '崇州市', '简阳市'],
  '绵阳市': ['涪城区', '游仙区', '安州区', '三台县', '盐亭县', '梓潼县', '北川羌族自治县', '平武县', '江油市'],
  '德阳市': ['旌阳区', '罗江区', '中江县', '广汉市', '什邡市', '绵竹市'],
  '泸州市': ['江阳区', '纳溪区', '龙马潭区', '泸县', '合江县', '叙永县', '古蔺县'],
  // 湖北省
  '武汉市': ['江岸区', '江汉区', '硚口区', '汉阳区', '武昌区', '青山区', '洪山区', '东西湖区', '汉南区', '蔡甸区', '江夏区', '黄陂区', '新洲区'],
  '宜昌市': ['西陵区', '伍家岗区', '点军区', '猇亭区', '夷陵区', '远安县', '兴山县', '秭归县', '长阳土家族自治县', '五峰土家族自治县', '宜都市', '当阳市', '枝江市'],
  '襄阳市': ['襄城区', '樊城区', '襄州区', '南漳县', '谷城县', '保康县', '老河口市', '枣阳市', '宜城市'],
  // 河南省
  '郑州市': ['中原区', '二七区', '管城回族区', '金水区', '上街区', '惠济区', '中牟县', '巩义市', '荥阳市', '新密市', '新郑市', '登封市'],
  '洛阳市': ['老城区', '西工区', '瀍河回族区', '涧西区', '吉利区', '洛龙区', '孟津区', '偃师区', '新安县', '栾川县', '嵩县', '汝阳县', '宜阳县', '洛宁县', '伊川县'],
  '开封市': ['龙亭区', '顺河回族区', '鼓楼区', '禹王台区', '祥符区', '杞县', '通许县', '尉氏县', '兰考县'],
  // 山东省
  '济南市': ['历下区', '市中区', '槐荫区', '天桥区', '历城区', '长清区', '章丘区', '济阳区', '莱芜区', '钢城区', '平阴县', '商河县'],
  '青岛市': ['市南区', '市北区', '黄岛区', '崂山区', '李沧区', '城阳区', '即墨区', '胶州市', '平度市', '莱西市'],
  '烟台市': ['芝罘区', '福山区', '牟平区', '莱山区', '蓬莱区', '长岛县', '龙口市', '莱阳市', '莱州市', '招远市', '栖霞市', '海阳市'],
  '潍坊市': ['潍城区', '寒亭区', '坊子区', '奎文区', '临朐县', '昌乐县', '青州市', '诸城市', '寿光市', '安丘市', '高密市', '昌邑市'],
  // 湖南省
  '长沙市': ['芙蓉区', '天心区', '岳麓区', '开福区', '雨花区', '望城区', '长沙县', '浏阳市', '宁乡市'],
  '株洲市': ['荷塘区', '芦淞区', '石峰区', '天元区', '株洲县', '攸县', '茶陵县', '炎陵县', '醴陵市'],
  '湘潭市': ['雨湖区', '岳塘区', '湘潭县', '湘乡市', '韶山市'],
  // 河北省
  '石家庄市': ['长安区', '桥西区', '新华区', '裕华区', '井陉矿区', '藁城区', '鹿泉区', '栾城区', '井陉县', '正定县', '行唐县', '灵寿县', '高邑县', '深泽县', '赞皇县', '无极县', '平山县', '元氏县', '赵县', '辛集市', '晋州市', '新乐市'],
  '唐山市': ['路南区', '路北区', '古冶区', '开平区', '丰南区', '丰润区', '曹妃甸区', '滦南县', '乐亭县', '迁西县', '玉田县', '遵化市', '迁安市'],
  '保定市': ['竞秀区', '莲池区', '满城区', '清苑区', '徐水区', '涞水县', '阜平县', '定兴县', '唐县', '高阳县', '容城县', '涞源县', '望都县', '安新县', '易县', '曲阳县', '蠡县', '顺平县', '博野县', '雄县', '涿州市', '定州市', '安国市', '高碑店市'],
  // 辽宁省
  '沈阳市': ['和平区', '沈河区', '大东区', '皇姑区', '铁西区', '苏家屯区', '浑南区', '沈北新区', '于洪区', '辽中区', '康平县', '法库县', '新民市'],
  '大连市': ['中山区', '西岗区', '沙河口区', '甘井子区', '旅顺口区', '金州区', '普兰店区', '长海县', '瓦房店市', '庄河市'],
  '鞍山市': ['铁东区', '铁西区', '立山区', '千山区', '台安县', '岫岩满族自治县', '海城市'],
  // 黑龙江省
  '哈尔滨市': ['道里区', '南岗区', '道外区', '平房区', '松北区', '香坊区', '呼兰区', '阿城区', '双城区', '依兰县', '方正县', '宾县', '巴彦县', '木兰县', '通河县', '延寿县', '尚志市', '五常市'],
  '齐齐哈尔市': ['龙沙区', '建华区', '铁锋区', '昂昂溪区', '富拉尔基区', '碾子山区', '梅里斯达斡尔族区', '龙江县', '依安县', '泰来县', '甘南县', '富裕县', '克山县', '克东县', '拜泉县', '讷河市'],
  // 吉林省
  '长春市': ['南关区', '宽城区', '朝阳区', '二道区', '绿园区', '双阳区', '九台区', '农安县', '榆树市', '德惠市', '公主岭市'],
  '吉林市': ['昌邑区', '龙潭区', '船营区', '丰满区', '永吉县', '蛟河市', '桦甸市', '舒兰市', '磐石市'],
  // 福建省
  '福州市': ['鼓楼区', '台江区', '仓山区', '马尾区', '晋安区', '长乐区', '闽侯县', '连江县', '罗源县', '闽清县', '永泰县', '平潭县', '福清市'],
  '厦门市': ['思明区', '海沧区', '湖里区', '集美区', '同安区', '翔安区'],
  '泉州市': ['鲤城区', '丰泽区', '洛江区', '泉港区', '惠安县', '安溪县', '永春县', '德化县', '金门县', '石狮市', '晋江市', '南安市'],
  // 云南省
  '昆明市': ['五华区', '盘龙区', '官渡区', '西山区', '东川区', '呈贡区', '晋宁区', '富民县', '宜良县', '石林彝族自治县', '嵩明县', '禄劝彝族苗族自治县', '寻甸回族彝族自治县', '安宁市'],
  '大理市': ['大理市', '祥云县', '宾川县', '弥渡县', '永平县', '云龙县', '洱源县', '剑川县', '鹤庆县', '漾濞彝族自治县', '南涧彝族自治县', '巍山彝族回族自治县'],
  // 贵州省
  '贵阳市': ['南明区', '云岩区', '花溪区', '乌当区', '白云区', '观山湖区', '开阳县', '息烽县', '修文县', '清镇市'],
  '遵义市': ['红花岗区', '汇川区', '播州区', '桐梓县', '绥阳县', '正安县', '道真仡佬族苗族自治县', '务川仡佬族苗族自治县', '凤冈县', '湄潭县', '余庆县', '习水县', '赤水市', '仁怀市'],
  // 广西壮族自治区
  '南宁市': ['兴宁区', '青秀区', '江南区', '西乡塘区', '良庆区', '邕宁区', '武鸣区', '隆安县', '马山县', '上林县', '宾阳县', '横州市'],
  '桂林市': ['秀峰区', '叠彩区', '象山区', '七星区', '雁山区', '临桂区', '阳朔县', '灵川县', '全州县', '兴安县', '永福县', '灌阳县', '龙胜各族自治县', '资源县', '平乐县', '荔浦市', '恭城瑶族自治县'],
  // 其他主要城市
  '太原市': ['小店区', '迎泽区', '杏花岭区', '尖草坪区', '万柏林区', '晋源区', '清徐县', '阳曲县', '娄烦县', '古交市'],
  '合肥市': ['瑶海区', '庐阳区', '蜀山区', '包河区', '长丰县', '肥东县', '肥西县', '庐江县', '巢湖市'],
  '南昌市': ['东湖区', '西湖区', '青云谱区', '湾里管理局', '青山湖区', '新建区', '南昌县', '安义县', '进贤县'],
  '海口市': ['秀英区', '龙华区', '琼山区', '美兰区'],
  '三亚市': ['海棠区', '吉阳区', '天涯区', '崖州区'],
  '兰州市': ['城关区', '七里河区', '西固区', '安宁区', '红古区', '永登县', '皋兰县', '榆中县'],
  '西宁市': ['城中区', '城东区', '城西区', '城北区', '大通回族土族自治县', '湟中区', '湟源县'],
  '银川市': ['兴庆区', '西夏区', '金凤区', '永宁县', '贺兰县', '灵武市'],
  '乌鲁木齐市': ['天山区', '沙依巴克区', '新市区', '水磨沟区', '头屯河区', '达坂城区', '米东区', '乌鲁木齐县'],
  '呼和浩特市': ['新城区', '回民区', '玉泉区', '赛罕区', '土默特左旗', '托克托县', '和林格尔县', '清水河县', '武川县'],
  '拉萨市': ['城关区', '林周县', '当雄县', '尼木县', '曲水县', '堆龙德庆区', '达孜区', '墨竹工卡县'],
  '台北市': ['松山区', '信义区', '大安区', '中山区', '中正区', '大同区', '万华区', '文山区', '南港区', '内湖区', '士林区', '北投区'],
  '香港特别行政区': ['中西区', '东区', '南区', '湾仔区', '九龙城区', '观塘区', '深水埗区', '黄大仙区', '油尖旺区', '离岛区', '葵青区', '北区', '西贡区', '沙田区', '大埔区', '荃湾区', '屯门区', '元朗区'],
  '澳门特别行政区': ['澳门半岛', '氹仔', '路环']
};

// 辅助函数：根据省份获取城市列表
export function getCitiesByProvince(province: string): string[] {
  return CITIES[province] || [];
}

// 辅助函数：根据城市获取区县列表
export function getDistrictsByCity(city: string): string[] {
  return DISTRICTS[city] || [];
}

// 排序函数
export function sortProvinces(provinces: string[]) {
  return [...provinces].sort((a, b) => {
    if (a === '陕西省') return -1;
    if (b === '陕西省') return 1;
    return a.localeCompare(b, 'zh-CN');
  });
}

export function sortCities(cities: string[], province: string) {
  return [...cities].sort((a, b) => {
    if (province === '陕西省') {
      if (a === '西安市') return -1;
      if (b === '西安市') return 1;
    }
    return a.localeCompare(b, 'zh-CN');
  });
}

export function sortDistricts(districts: string[], city: string) {
  return [...districts].sort((a, b) => {
    if (city === '西安市') {
      if (a === '周至县') return -1;
      if (b === '周至县') return 1;
    }
    return a.localeCompare(b, 'zh-CN');
  });
}

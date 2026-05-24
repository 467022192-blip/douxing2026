import { useAuthStore } from '../stores/authStore';
import { useAppStore } from '../stores/appStore';
import type { UserProfile, UserCheckin } from '../types';
import { MOCK_ATTRACTIONS } from '../data/mockAttractions';

/**
 * 测试辅助函数 - 模拟用户登录
 */
export const mockLogin = (userData?: Partial<UserProfile>) => {
  const defaultUser: UserProfile = {
    id: 'test-user-' + Date.now(),
    email: 'test@example.com',
    phone: '13800138000',
    nickname: '测试用户',
    avatar_url: 'https://picsum.photos/100/100?random=99',
    is_private: false,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...userData,
  };

  useAuthStore.setState({
    user: defaultUser,
    isAuthenticated: true,
  });
  console.log('[TestHelper] 用户已登录:', defaultUser.nickname);
  return defaultUser;
};

/**
 * 测试辅助函数 - 用户登出
 */
export const mockLogout = () => {
  useAuthStore.getState().logout();
  console.log('[TestHelper] 用户已登出');
};

/**
 * 测试辅助函数 - 获取当前认证状态
 */
export const getAuthStatus = () => {
  const state = useAuthStore.getState();
  return {
    isAuthenticated: state.isAuthenticated,
    user: state.user,
  };
};

/**
 * 测试辅助函数 - 添加模拟打卡数据
 */
export const addMockCheckins = () => {
  const { addCheckin } = useAppStore.getState();
  const userId = useAuthStore.getState().user?.id || 'guest';

  // 添加一些去过的景区
  const visitedAttractions = [0, 1, 2, 5, 8, 12]; // 故宫、天坛、颐和园、西湖、黄山、兵马俑
  visitedAttractions.forEach((index) => {
    const attraction = MOCK_ATTRACTIONS[index];
    if (attraction) {
      const checkin: UserCheckin = {
        id: `checkin-visited-${index}`,
        user_id: userId,
        attraction_id: attraction.id,
        status: 'visited',
        visit_count: 1,
        visited_at: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000).toISOString(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      addCheckin(checkin);
    }
  });

  // 添加一些想去的景区
  const wantToVisitAttractions = [3, 6, 9, 15]; // 八达岭、黄山、苏州园林、张家界
  wantToVisitAttractions.forEach((index) => {
    const attraction = MOCK_ATTRACTIONS[index];
    if (attraction) {
      const checkin: UserCheckin = {
        id: `checkin-want-${index}`,
        user_id: userId,
        attraction_id: attraction.id,
        status: 'want_to_visit',
        visit_count: 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      addCheckin(checkin);
    }
  });

  console.log('[TestHelper] 已添加模拟打卡数据');
  console.log(`  - 去过: ${visitedAttractions.length} 个景区`);
  console.log(`  - 想去: ${wantToVisitAttractions.length} 个景区`);
};

/**
 * 测试辅助函数 - 清除所有打卡数据
 */
export const clearCheckins = () => {
  const { checkins, removeCheckin } = useAppStore.getState();
  checkins.forEach((c) => removeCheckin(c.id));
  console.log('[TestHelper] 已清除所有打卡数据');
};

/**
 * 测试场景1: 完整的点赞测试流程
 * 在浏览器控制台运行: testScenarios.likeFlow()
 */
export const testLikeFlow = () => {
  console.log('=== 开始点赞功能测试 ===');

  // 步骤1: 登录
  mockLogin({ nickname: '点赞测试用户' });

  // 步骤2: 验证登录状态
  const authStatus = getAuthStatus();
  console.log('登录状态:', authStatus.isAuthenticated ? '已登录' : '未登录');
  console.log('当前用户:', authStatus.user?.nickname);

  console.log('=== 请手动测试以下步骤 ===');
  console.log('1. 切换到"空间"页面');
  console.log('2. 找到第一个动态（故宫相关）');
  console.log('3. 点击点赞按钮（心形图标）');
  console.log('4. 观察点赞数是否从128变为129');
  console.log('5. 观察按钮颜色是否变为红色');
  console.log('6. 再次点击，观察是否取消点赞');

  return {
    message: '点赞测试流程已启动，请按上述步骤手动测试',
    currentUser: authStatus.user,
  };
};

/**
 * 测试场景2: 完整的评论测试流程
 * 在浏览器控制台运行: testScenarios.commentFlow()
 */
export const testCommentFlow = () => {
  console.log('=== 开始评论功能测试 ===');

  // 步骤1: 登录
  mockLogin({ nickname: '评论测试用户' });

  // 步骤2: 验证登录状态
  const authStatus = getAuthStatus();
  console.log('登录状态:', authStatus.isAuthenticated ? '已登录' : '未登录');

  console.log('=== 请手动测试以下步骤 ===');
  console.log('1. 切换到"空间"页面');
  console.log('2. 找到第一个动态');
  console.log('3. 点击评论按钮（对话气泡图标）');
  console.log('4. 观察评论弹窗是否打开');
  console.log('5. 查看已有评论是否显示');
  console.log('6. 在输入框中输入测试评论');
  console.log('7. 点击发送按钮');
  console.log('8. 观察评论是否被添加到列表');
  console.log('9. 观察评论数是否增加');
  console.log('10. 点击关闭按钮，观察弹窗是否关闭');

  return {
    message: '评论测试流程已启动，请按上述步骤手动测试',
    currentUser: authStatus.user,
  };
};

/**
 * 测试场景3: 完整用户场景
 * 在浏览器控制台运行: testScenarios.fullScenario()
 */
export const fullScenario = () => {
  console.log('=== 开始完整用户场景测试 ===');

  // 场景: 用户登录 -> 浏览动态 -> 点赞 -> 评论
  mockLogin({ nickname: '完整测试用户' });

  const authStatus = getAuthStatus();

  console.log('=== 完整测试场景 ===');
  console.log('用户已登录:', authStatus.user?.nickname);
  console.log('');
  console.log('测试步骤:');
  console.log('1. 确认当前在"空间"页面');
  console.log('2. 浏览动态列表，确认显示正常');
  console.log('3. 对第一个动态进行点赞');
  console.log('   - 验证点赞数+1');
  console.log('   - 验证按钮变红');
  console.log('4. 打开该动态的评论');
  console.log('   - 验证弹窗打开');
  console.log('   - 验证已有评论显示');
  console.log('5. 提交一条新评论');
  console.log('   - 验证评论出现在列表');
  console.log('   - 验证评论数+1');
  console.log('6. 关闭评论弹窗');
  console.log('7. 取消刚才的点赞');
  console.log('   - 验证点赞数-1');
  console.log('   - 验证按钮变灰');

  return {
    message: '完整测试场景已启动',
    user: authStatus.user,
    steps: 7,
  };
};

/**
 * 测试场景4: 未登录状态测试
 * 在浏览器控制台运行: testScenarios.guestScenario()
 */
export const guestScenario = () => {
  console.log('=== 开始未登录用户测试 ===');

  // 确保用户已登出
  mockLogout();

  const authStatus = getAuthStatus();
  console.log('当前状态:', authStatus.isAuthenticated ? '已登录' : '未登录');

  console.log('=== 未登录用户测试步骤 ===');
  console.log('1. 切换到"空间"页面');
  console.log('2. 验证动态列表可以正常浏览');
  console.log('3. 验证点赞数可以正常查看');
  console.log('4. 尝试点击点赞按钮（应该也能工作，因为目前是本地存储）');
  console.log('5. 尝试打开评论查看');

  return {
    message: '未登录用户测试场景已启动',
    isAuthenticated: authStatus.isAuthenticated,
  };
};

/**
 * 测试场景5: "我的"页面测试
 * 在浏览器控制台运行: testScenarios.profileScenario()
 */
export const profileScenario = () => {
  console.log('=== 开始"我的"页面测试 ===');

  // 清除之前的打卡数据
  clearCheckins();

  // 登录用户
  mockLogin({
    nickname: '旅行达人',
    avatar_url: 'https://picsum.photos/100/100?random=88',
  });

  // 添加模拟打卡数据
  addMockCheckins();

  const authStatus = getAuthStatus();
  const { checkins } = useAppStore.getState();

  console.log('=== "我的"页面测试步骤 ===');
  console.log('用户:', authStatus.user?.nickname);
  console.log('去过:', checkins.filter((c) => c.status === 'visited').length);
  console.log('想去:', checkins.filter((c) => c.status === 'want_to_visit').length);
  console.log('');
  console.log('测试步骤:');
  console.log('1. 切换到"我的"页面');
  console.log('2. 验证用户信息显示正确（头像、昵称、等级）');
  console.log('3. 验证统计卡片显示正确（去过、想去、省份、动态）');
  console.log('4. 验证打卡进度条显示正确');
  console.log('5. 验证最近打卡列表显示正确');
  console.log('6. 点击"编辑资料"，测试修改昵称');
  console.log('7. 测试隐私设置开关');
  console.log('');
  console.log('提示: 刷新页面后数据会保持（使用localStorage持久化）');

  return {
    message: '"我的"页面测试场景已启动',
    user: authStatus.user,
    checkins: checkins,
  };
};

/**
 * 将所有测试函数挂载到window对象，方便在浏览器控制台调用
 */
export const initTestHelpers = () => {
  (window as any).testScenarios = {
    likeFlow: testLikeFlow,
    commentFlow: testCommentFlow,
    fullScenario: fullScenario,
    guestScenario: guestScenario,
    profileScenario: profileScenario,
    login: mockLogin,
    logout: mockLogout,
    getAuthStatus: getAuthStatus,
    addMockCheckins: addMockCheckins,
    clearCheckins: clearCheckins,
  };

  console.log('=== 测试辅助函数已加载 ===');
  console.log('可用的测试命令:');
  console.log('- testScenarios.likeFlow()       - 点赞功能测试');
  console.log('- testScenarios.commentFlow()    - 评论功能测试');
  console.log('- testScenarios.fullScenario()   - 完整场景测试');
  console.log('- testScenarios.guestScenario()  - 未登录用户测试');
  console.log('- testScenarios.profileScenario() - "我的"页面测试');
  console.log('- testScenarios.login(userData)  - 模拟登录');
  console.log('- testScenarios.logout()         - 模拟登出');
  console.log('- testScenarios.getAuthStatus()  - 获取认证状态');
  console.log('- testScenarios.addMockCheckins() - 添加模拟打卡数据');
  console.log('- testScenarios.clearCheckins()  - 清除打卡数据');
};

export default {
  mockLogin,
  mockLogout,
  getAuthStatus,
  addMockCheckins,
  clearCheckins,
  testLikeFlow,
  testCommentFlow,
  fullScenario,
  guestScenario,
  profileScenario,
  initTestHelpers,
};

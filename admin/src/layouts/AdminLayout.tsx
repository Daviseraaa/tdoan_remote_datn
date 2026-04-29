import { useMemo, useState } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  Layout,
  Menu,
  Dropdown,
  Avatar,
  theme,
  Typography,
  Space,
  Grid,
  Drawer,
  Button,
} from 'antd';
import type { MenuProps } from 'antd';
import {
  DashboardOutlined,
  UserOutlined,
  DesktopOutlined,
  UnorderedListOutlined,
  ThunderboltOutlined,
  HistoryOutlined,
  LogoutOutlined,
  TeamOutlined,
  MenuOutlined,
} from '@ant-design/icons';
import { useAuth } from '@/providers/AuthProvider';

const { Header, Sider, Content } = Layout;

export function AdminLayout() {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout, isAdmin } = useAuth();
  const screens = Grid.useBreakpoint();
  const isMobile = !screens.lg;

  const menuItems = useMemo<MenuProps['items']>(() => {
    const base = [
      { key: '/dashboard', icon: <DashboardOutlined />, label: 'Dashboard' },
      { key: '/agents', icon: <DesktopOutlined />, label: 'Agent' },
      { key: '/tasks', icon: <UnorderedListOutlined />, label: 'Task' },
      { key: '/workflows', icon: <ThunderboltOutlined />, label: 'Workflow' },
    ];
    if (!isAdmin) return base;
    return [
      ...base,
      { key: '/users', icon: <TeamOutlined />, label: 'Người dùng' },
      { key: '/audit', icon: <HistoryOutlined />, label: 'Audit log' },
    ];
  }, [isAdmin]);
  const {
    token: { colorBgContainer, borderRadiusLG },
  } = theme.useToken();

  const selectedKey = useMemo(() => {
    const keys = ['/dashboard', '/agents', '/remote', '/tasks', '/workflows'];
    if (isAdmin) keys.push('/users', '/audit');
    keys.sort((a, b) => b.length - a.length);
    if (location.pathname.startsWith('/remote/')) return ['/agents'];
    const match = keys.find((k) => location.pathname.startsWith(k));
    return match ? [match] : ['/dashboard'];
  }, [location.pathname, isAdmin]);

  const handleNavigate = (key: string) => {
    navigate(key);
    if (isMobile) {
      setMobileMenuOpen(false);
    }
  };

  return (
    <Layout style={{ minHeight: '100vh' }}>
      {!isMobile && (
        <Sider
          collapsible
          collapsed={collapsed}
          onCollapse={setCollapsed}
          breakpoint="lg"
          theme="dark"
        >
          <div
            style={{
              color: 'white',
              fontWeight: 700,
              fontSize: 18,
              padding: '16px 24px',
              letterSpacing: 1,
            }}
          >
            {collapsed ? 'DC' : 'DATN CONSOLE'}
          </div>
          <Menu
            theme="dark"
            mode="inline"
            selectedKeys={selectedKey}
            items={menuItems}
            onClick={({ key }) => handleNavigate(String(key))}
          />
        </Sider>
      )}

      <Layout>
        <Header
          style={{
            background: colorBgContainer,
            padding: isMobile ? '0 12px' : '0 24px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderBottom: '1px solid #f0f0f0',
          }}
        >
          <Space size={12}>
            {isMobile && (
              <Button
                type="text"
                icon={<MenuOutlined />}
                onClick={() => setMobileMenuOpen(true)}
                aria-label="Mở menu"
              />
            )}
            <Typography.Title level={isMobile ? 5 : 4} style={{ margin: 0 }}>
              {isAdmin ? 'Quản trị hệ thống' : 'Bảng điều khiển'}
            </Typography.Title>
          </Space>

          <Dropdown
            menu={{
              items: [
                {
                  key: 'logout',
                  icon: <LogoutOutlined />,
                  label: 'Đăng xuất',
                  onClick: async () => {
                    await logout();
                    navigate('/login');
                  },
                },
              ],
            }}
          >
            <Space style={{ cursor: 'pointer' }}>
              <Avatar icon={<UserOutlined />} />
              {!isMobile && <span>{user?.name ?? user?.email}</span>}
            </Space>
          </Dropdown>
        </Header>

        <Content
          style={{
            margin: isMobile ? 8 : 16,
            padding: isMobile ? 12 : 24,
            background: colorBgContainer,
            borderRadius: borderRadiusLG,
            minHeight: 'calc(100vh - 96px)',
          }}
        >
          <div className="page-content">
            <Outlet />
          </div>
        </Content>
      </Layout>

      <Drawer
        title="DATN CONSOLE"
        placement="left"
        open={mobileMenuOpen}
        width={280}
        onClose={() => setMobileMenuOpen(false)}
        bodyStyle={{ padding: 0 }}
      >
        <Menu
          mode="inline"
          selectedKeys={selectedKey}
          items={menuItems}
          onClick={({ key }) => handleNavigate(String(key))}
        />
      </Drawer>
    </Layout>
  );
}

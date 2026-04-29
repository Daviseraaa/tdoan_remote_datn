import { Alert, Button, Space, Typography } from 'antd';
import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  message: string;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, message: '' };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, message: error.message || 'Unknown error' };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // eslint-disable-next-line no-console
    console.error('Admin UI crash', error, errorInfo);
  }

  private reload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: 24 }}>
          <Typography.Title level={4}>Admin UI gặp lỗi</Typography.Title>
          <Space direction="vertical" size={16}>
            <Alert
              type="error"
              showIcon
              message="Ứng dụng tạm thời không ổn định"
              description={this.state.message}
            />
            <Button type="primary" onClick={this.reload}>
              Tải lại trang
            </Button>
          </Space>
        </div>
      );
    }

    return this.props.children;
  }
}

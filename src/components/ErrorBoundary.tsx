/**
 * 错误边界——防止单个组件崩溃导致整页白屏
 * 「桃华加的保险丝，万一哪里出问题也不至于全白」
 */

import { Component, ReactNode } from 'react'

interface Props {
  children: ReactNode
  fallback?: ReactNode
}

interface State {
  hasError: boolean
}

export default class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(): State {
    return { hasError: true }
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback ?? (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100%',
          color: 'var(--text-secondary)',
          fontSize: 13,
        }}>
          😢 出了点小问题，切换一下页面就好了～
        </div>
      )
    }
    return this.props.children
  }
}

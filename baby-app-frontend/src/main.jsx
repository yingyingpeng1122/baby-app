import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css' // 确保引入了 CSS

// 顶层错误边界：任何渲染异常都显示可读提示，而不是整页白屏
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { error: null }
  }
  static getDerivedStateFromError(error) {
    return { error }
  }
  componentDidCatch(error, info) {
    console.error('App crashed:', error, info)
  }
  render() {
    if (this.state.error) {
      return (
        <div className="app app--center">
          <div className="form" style={{ maxWidth: 460 }}>
            <div className="form__head">
              <div className="form__logo" style={{ background: 'var(--coral-soft)', color: 'var(--coral)' }}>
                <span style={{ fontSize: 22 }}>⚠️</span>
              </div>
              <h1 className="form__title">页面出现了一点问题</h1>
              <p className="form__sub">已记录错误，可刷新页面重试；若反复出现请把下方信息反馈开发者。</p>
            </div>
            <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontSize: 12, color: 'var(--muted)', background: 'var(--surface-2)', padding: 12, borderRadius: 12, maxHeight: 240, overflow: 'auto' }}>
              {String(this.state.error && this.state.error.stack || this.state.error)}
            </pre>
            <button className="btn btn--primary" onClick={() => location.reload()}>刷新页面</button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>,
)

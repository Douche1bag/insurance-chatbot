export default function ChatHeader() {
  return (
    <header className="chat-header">
      <div className="chat-header-content">
        <div className="chat-header-icon">
          📄 {/* Replaced FileText icon */}
        </div>
        <div className="chat-header-text">
          <h1>ผู้ช่วยสรุปกรมธรรม์ประกันภัย</h1>
          <p>Powered by Typhoon AI</p>
        </div>
      </div>
    </header>
  );
}
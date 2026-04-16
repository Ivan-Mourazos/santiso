"use client";

export default function Footer() {
  return (
    <footer className="footer">
      <div className="container footer-content">
        <div className="footer-brand">
          <h3>UD <span className="text-primary">SANTISO</span></h3>
          <p>Unión Deportiva Santiso.</p>
        </div>
        <div className="footer-bottom">
          <p>&copy; {new Date().getFullYear()} UD Santiso. Pasión por el fútbol.</p>
        </div>
      </div>

      <style jsx>{`
        .footer {
          background: #000;
          padding: 4rem 0 2rem;
          border-top: 1px solid var(--border);
          margin-top: auto;
        }
        .footer-content {
          text-align: center;
        }
        .footer-brand h3 {
          font-size: 2rem;
          margin-bottom: 0.5rem;
        }
        .footer-brand p {
          color: #a3a3a3;
          margin-bottom: 2rem;
        }
        .footer-bottom {
          border-top: 1px solid var(--border);
          padding-top: 2rem;
          color: #525252;
          font-size: 0.8rem;
        }
      `}</style>
    </footer>
  );
}

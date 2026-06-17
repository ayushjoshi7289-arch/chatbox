export function Card({ children }) {
  return <div className="bg-white rounded-xl shadow">{children}</div>;
}

export function CardContent({ children, className }) {
  return <div className={`p-4 ${className}`}>{children}</div>;
}

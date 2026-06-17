export function Button({ children, onClick, variant = "primary", size = "md", ...props }) {
  const base = "px-4 py-2 rounded font-medium transition";
  const variants = {
    primary: "bg-blue-600 text-white hover:bg-blue-700",
    secondary: "bg-green-600 text-white hover:bg-green-700",
    outline: "border border-gray-400 text-gray-700 hover:bg-gray-100",
  };
  const sizes = {
    md: "text-sm",
    sm: "text-xs px-3 py-1",
  };

  return (
    <button onClick={onClick} className={`${base} ${variants[variant]} ${sizes[size]}`} {...props}>
      {children}
    </button>
  );
}

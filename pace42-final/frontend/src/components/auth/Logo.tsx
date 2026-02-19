import { Link } from 'react-router-dom';

export function Logo() {
  return (
    <Link to="/" className="flex items-center gap-2">
      <div className="w-2 h-2 rounded-full bg-[#00D4AA]" />
      <span className="font-display font-semibold text-lg tracking-tight text-white">
        pace42
      </span>
    </Link>
  );
}

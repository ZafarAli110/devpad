import { ChevronLeft, ChevronRight } from 'lucide-react';

interface PaginationProps {
    currentPage: number;
    totalPages: number;
    onPageChange: (page: number) => void;
    itemsPerPage: number;
    totalItems: number;
    compact?: boolean;
}

export function Pagination({ currentPage, totalPages, onPageChange, itemsPerPage, totalItems }: PaginationProps) {
    if (totalPages <= 1) return null;

    const renderPageNumbers = () => {

        const delta = 1; // Number of pages to show around current
        const left = currentPage - delta;
        const right = currentPage + delta + 1;
        const range = [];
        const rangeWithDots = [];
        let l;

        for (let i = 1; i <= totalPages; i++) {
            if (i === 1 || i === totalPages || (i >= left && i < right)) {
                range.push(i);
            }
        }

        for (const i of range) {
            if (l) {
                if (i - l === 2) {
                    rangeWithDots.push(l + 1);
                } else if (i - l !== 1) {
                    rangeWithDots.push('...');
                }
            }
            rangeWithDots.push(i);
            l = i;
        }

        return rangeWithDots.map((page, index) => {
            if (page === '...') {
                return (
                    <span key={`dots-${index}`} className="px-2 py-1 text-text-muted text-xs">
                        ...
                    </span>
                );
            }
            return (
                <button
                    key={page}
                    onClick={() => onPageChange(page as number)}
                    className={`min-w-[32px] h-8 flex items-center justify-center rounded-lg text-xs font-bold transition-all ${
                        currentPage === page
                            ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20 scale-100'
                            : 'text-text-secondary hover:bg-bg-element hover:text-text-primary'
                    }`}
                >
                    {page}
                </button>
            );
        });
    };

    return (
        <div className="flex items-center justify-between py-2 animate-in fade-in slide-in-from-top-2">
            <div className="flex items-center gap-1 bg-bg-panel border border-border rounded-xl p-1 shadow-sm">
                <button
                    onClick={() => onPageChange(currentPage - 1)}
                    disabled={currentPage === 1}
                    className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-bg-element disabled:opacity-30 disabled:hover:bg-transparent disabled:cursor-not-allowed text-text-secondary transition-colors"
                >
                    <ChevronLeft className="w-4 h-4" />
                </button>
                
                <div className="flex items-center px-1">
                    {renderPageNumbers()}
                </div>

                <button
                    onClick={() => onPageChange(currentPage + 1)}
                    disabled={currentPage === totalPages}
                    className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-bg-element disabled:opacity-30 disabled:hover:bg-transparent disabled:cursor-not-allowed text-text-secondary transition-colors"
                >
                    <ChevronRight className="w-4 h-4" />
                </button>
            </div>

            <div className="text-xs text-text-muted font-medium">
                Showing <span className="text-text-primary">{Math.min((currentPage - 1) * itemsPerPage + 1, totalItems)}-{Math.min(currentPage * itemsPerPage, totalItems)}</span> of <span className="text-text-primary">{totalItems}</span>
            </div>
        </div>
    );
}

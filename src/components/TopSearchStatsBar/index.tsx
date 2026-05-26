import { CheckCircle2, Grid, Heart, Search, X } from 'lucide-react';

type FilterType = 'all' | 'want_to_visit' | 'visited';

type Props = {
  searchQuery: string;
  onSearchQueryChange: (value: string) => void;
  filterType: FilterType;
  onFilterTypeChange: (value: FilterType) => void;
  totalCount: number;
  wantToVisitCount: number;
  visitedCount: number;
};

export default function TopSearchStatsBar({
  searchQuery,
  onSearchQueryChange,
  filterType,
  onFilterTypeChange,
  totalCount,
  wantToVisitCount,
  visitedCount
}: Props) {
  return (
    <>
      <div className="relative mb-4">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          <Search size={18} className="text-gray-400" />
        </div>
        <input
          type="text"
          placeholder="搜索景区名称或城市..."
          value={searchQuery}
          onChange={(e) => onSearchQueryChange(e.target.value)}
          className="w-full bg-gray-100 text-sm text-gray-900 rounded-full pl-10 pr-10 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition-all"
        />
        {searchQuery && (
          <button onClick={() => onSearchQueryChange('')} className="absolute inset-y-0 right-0 pr-3 flex items-center" aria-label="清空搜索">
            <X size={16} className="text-gray-400 hover:text-gray-600" />
          </button>
        )}
      </div>

      <div className="flex justify-between">
        <div
          className={`flex flex-col items-center justify-center p-3 rounded-2xl flex-1 mr-2 transition-colors ${
            filterType === 'all' ? 'bg-blue-50 text-blue-600' : 'bg-gray-50 text-gray-600'
          } cursor-pointer`}
          onClick={() => onFilterTypeChange('all')}
        >
          <div className="flex items-center gap-1.5 mb-1">
            <Grid size={16} className={filterType === 'all' ? 'text-blue-500' : 'text-gray-400'} />
            <span className="font-medium text-sm">推荐</span>
          </div>
          <div
            className={`text-xs px-2 py-0.5 rounded-full font-bold ${
              filterType === 'all' ? 'bg-blue-500 text-white' : 'bg-gray-200 text-gray-600'
            }`}
          >
            {totalCount}
          </div>
        </div>

        <div
          className={`flex flex-col items-center justify-center p-3 rounded-2xl flex-1 mr-2 transition-colors ${
            filterType === 'want_to_visit' ? 'bg-amber-50 text-amber-600' : 'bg-gray-50 text-gray-600'
          } cursor-pointer`}
          onClick={() => onFilterTypeChange('want_to_visit')}
        >
          <div className={`flex items-center gap-1.5 mb-1 ${filterType === 'want_to_visit' ? 'text-amber-600' : 'text-gray-500'}`}>
            <Heart size={16} className={`text-amber-500 ${filterType === 'want_to_visit' ? 'fill-amber-500' : ''}`} />
            <span className="text-xs whitespace-nowrap">想去</span>
          </div>
          <span className="font-bold text-lg leading-none">{wantToVisitCount}</span>
        </div>

        <div
          className={`flex flex-col items-center justify-center p-3 rounded-2xl flex-1 transition-colors ${
            filterType === 'visited' ? 'bg-emerald-50 text-emerald-600' : 'bg-gray-50 text-gray-600'
          } cursor-pointer`}
          onClick={() => onFilterTypeChange('visited')}
        >
          <div className={`flex items-center gap-1.5 mb-1 ${filterType === 'visited' ? 'text-emerald-600' : 'text-gray-500'}`}>
            <CheckCircle2 size={16} className="text-emerald-500" />
            <span className="text-xs whitespace-nowrap">去过</span>
          </div>
          <span className="font-bold text-lg leading-none">{visitedCount}</span>
        </div>
      </div>
    </>
  );
}


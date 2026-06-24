import { cva } from 'class-variance-authority';

export { Button, buttonVariants } from './ui/Button';

export const toggleVariants = cva('px-2 py-0.5 text-xs rounded transition-colors', {
  variants: {
    active: {
      true: 'bg-indigo-600 text-white',
      false: 'bg-gray-700 hover:bg-gray-600',
    },
  },
  defaultVariants: {
    active: false,
  },
});

export const answerVariants = cva('w-full text-left p-3 rounded-lg border transition-colors', {
  variants: {
    state: {
      correct: 'bg-emerald-900/30 border-emerald-600',
      wrong: 'bg-red-900/30 border-red-600',
      selected: 'bg-indigo-900/30 border-indigo-600',
      neutral: 'bg-gray-750 border-gray-600 hover:border-gray-500',
    },
  },
  defaultVariants: {
    state: 'neutral',
  },
});

export const filterVariants = cva('px-3 py-1 text-xs rounded transition-colors', {
  variants: {
    active: {
      true: 'bg-indigo-600 text-white',
      false: 'bg-gray-700 hover:bg-gray-600',
    },
  },
  defaultVariants: {
    active: false,
  },
});

export const selectableCardVariants = cva('p-3 rounded-xl border-2 transition-all', {
  variants: {
    selected: {
      true: 'border-indigo-500 bg-indigo-900/30',
      false: 'border-gray-700 bg-gray-800/50 hover:border-gray-500',
    },
  },
  defaultVariants: {
    selected: false,
  },
});

export const selectableItemVariants = cva('transition-colors', {
  variants: {
    selected: {
      true: 'bg-indigo-600/20 text-indigo-300',
      false: 'text-gray-300 hover:bg-gray-700',
    },
  },
  defaultVariants: {
    selected: false,
  },
});

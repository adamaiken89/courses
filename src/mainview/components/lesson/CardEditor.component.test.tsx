import { render } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, mock, test } from 'bun:test';

import CardEditor from './CardEditor';

const defaultProps = {
  selectedText: 'selected text',
  x: 200,
  y: 300,
  onSave: () => {},
  onCancel: () => {},
};

describe('CardEditor', () => {
  const user = userEvent.setup();

  test('renders with selected text and placeholders', () => {
    const { getByText } = render(<CardEditor {...defaultProps} />);
    expect(getByText('Create Card')).toBeInTheDocument();
    expect(getByText('Front')).toBeInTheDocument();
    expect(getByText('Back')).toBeInTheDocument();
  });

  test('save button calls onSave with front and back', async () => {
    const onSave = mock(() => {});
    const { getByDisplayValue, getByText } = render(
      <CardEditor {...defaultProps} onSave={onSave} />,
    );
    const frontInput = getByDisplayValue('selected text');
    const backInput = document.querySelectorAll('textarea')[1];
    await user.clear(frontInput);
    await user.type(frontInput, 'Q?');
    await user.type(backInput, 'A!');
    await user.click(getByText('Save'));
    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onSave).toHaveBeenCalledWith('Q?', 'A!');
  });

  test('save disabled when front empty', async () => {
    const onSave = mock(() => {});
    const { getByDisplayValue, getByText } = render(
      <CardEditor {...defaultProps} onSave={onSave} />,
    );
    const frontInput = getByDisplayValue('selected text');
    await user.clear(frontInput);
    const saveBtn = getByText('Save').closest('button');
    expect(saveBtn).toBeDisabled();
  });

  test('save disabled when back empty', () => {
    const { getByText } = render(<CardEditor {...defaultProps} />);
    const saveBtn = getByText('Save').closest('button');
    expect(saveBtn).toBeDisabled();
  });

  test('cancel calls onCancel', async () => {
    const onCancel = mock(() => {});
    const { getByText } = render(<CardEditor {...defaultProps} onCancel={onCancel} />);
    await user.click(getByText('Cancel'));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});

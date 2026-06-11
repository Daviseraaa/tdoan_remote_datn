import { asciiSlugKey } from './slug-key';

describe('asciiSlugKey', () => {
  it('transliterates Vietnamese before slugging', () => {
    expect(asciiSlugKey('Thông tin hệ thống')).toBe('thong_tin_he_thong');
    expect(asciiSlugKey('Tạo biến')).toBe('tao_bien');
    expect(asciiSlugKey('Đọc biến')).toBe('doc_bien');
  });
});

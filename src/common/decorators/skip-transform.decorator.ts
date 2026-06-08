import { SetMetadata } from '@nestjs/common';
import { SKIP_TRANSFORM_KEY } from '../constants/response';

/** Trả response thô — dùng cho SePay webhook (`{"success": true}`). */
export const SkipTransform = () => SetMetadata(SKIP_TRANSFORM_KEY, true);

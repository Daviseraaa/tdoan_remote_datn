import { SetMetadata } from '@nestjs/common';
import { SKIP_SUBSCRIPTION_KEY } from '../constants/subscription';

export const SkipSubscription = () => SetMetadata(SKIP_SUBSCRIPTION_KEY, true);

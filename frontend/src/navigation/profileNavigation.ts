import { CommonActions } from '@react-navigation/native';
import type { ProfileScreenName } from './profileScreens';

function navigatorHasScreen(nav: { getState?: () => { routeNames?: string[] } }, name: string) {
  return nav.getState?.()?.routeNames?.includes(name);
}

/** Navigate to a profile sub-screen from ProfileMain (works with tab + stack nesting). */
export function navigateProfileScreen(
  navigation: any,
  screen: ProfileScreenName,
  params?: Record<string, unknown>
) {
  if (navigatorHasScreen(navigation, screen)) {
    navigation.navigate(screen, params);
    return;
  }

  let parent = navigation.getParent?.();
  while (parent) {
    if (navigatorHasScreen(parent, screen)) {
      parent.navigate(screen, params);
      return;
    }
    parent = parent.getParent?.();
  }

  navigation.dispatch(
    CommonActions.navigate({
      name: 'Account',
      params: { screen, params },
    })
  );
}

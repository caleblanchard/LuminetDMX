import { Routes } from '@angular/router';

export const routes: Routes = [
  { path: '', redirectTo: '/virtual-console', pathMatch: 'full' },
  { 
    path: 'virtual-console', 
    loadComponent: () => import('./components/virtual-console/virtual-console.component').then(c => c.VirtualConsoleComponent)
  },
  { 
    path: 'console', 
    loadComponent: () => import('./components/console/console.component').then(c => c.ConsoleComponent)
  },
  { 
    path: 'fixtures', 
    loadComponent: () => import('./components/fixtures/fixtures.component').then(c => c.FixturesComponent)
  },
  { 
    path: 'patches', 
    loadComponent: () => import('./components/patches/patches.component').then(c => c.PatchesComponent)
  },
  { 
    path: 'groups', 
    loadComponent: () => import('./components/groups/groups.component').then(c => c.GroupsComponent)
  },
  { 
    path: 'light-control', 
    loadComponent: () => import('./components/light-control/light-control.component').then(c => c.LightControlComponent)
  },
  { 
    path: 'presets', 
    loadComponent: () => import('./components/presets/presets.component').then(c => c.PresetsComponent)
  },
  { 
    path: 'settings', 
    loadComponent: () => import('./components/settings/settings.component').then(c => c.SettingsComponent)
  }
];
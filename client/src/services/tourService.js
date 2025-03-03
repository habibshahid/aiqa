// src/services/tourService.js
import Shepherd from 'shepherd.js';
import 'shepherd.js/dist/css/shepherd.css';

// Define tour configuration
const tourConfig = {
  defaultStepOptions: {
    cancelIcon: {
      enabled: true
    },
    classes: 'shepherd-theme-default',
    scrollTo: true,
    arrow: true
  },
  useModalOverlay: true,
  exitOnEsc: true
};

// Tour steps for main features
const tourSteps = [
  {
    id: 'welcome',
    title: 'Welcome to AIQA!',
    text: 'Let us show you around the interface and help you get started with the automated quality assessment system. Click "Next" to begin the tour.',
    attachTo: {
      element: 'body',
      on: 'center'
    },
    buttons: [
      {
        text: 'Skip Tour',
        action: function() {
          return this.cancel();
        },
        classes: 'shepherd-button-secondary'
      },
      {
        text: 'Next',
        action: function() {
          return this.next();
        }
      }
    ]
  },
  {
    id: 'navigation',
    title: 'Navigation Menu',
    text: 'This sidebar lets you navigate between different sections of the application.',
    attachTo: {
      element: '.bg-light.border-end',
      on: 'right'
    },
    buttons: [
      {
        text: 'Back',
        action: function() {
          return this.back();
        }
      },
      {
        text: 'Next',
        action: function() {
          return this.next();
        }
      }
    ]
  },
  {
    id: 'top-bar',
    title: 'Top Navigation Bar',
    text: 'The top bar shows the current page title and provides access to notifications, the evaluation queue, and your profile settings.',
    attachTo: {
      element: '.bg-white.border-bottom',
      on: 'bottom'
    },
    buttons: [
      {
        text: 'Back',
        action: function() {
          return this.back();
        }
      },
      {
        text: 'Next',
        action: function() {
          return this.next();
        }
      }
    ]
  },
  {
    id: 'queue-monitor',
    title: 'Evaluation Queue',
    text: 'Monitor active evaluation jobs. Click this icon to see the status of all evaluation processes.',
    attachTo: {
      element: '.btn-light svg[data-icon="list-checks"]',
      on: 'bottom'
    },
    beforeShowPromise: function() {
      return new Promise(resolve => {
        // Ensure queue monitor button is visible before proceeding
        setTimeout(resolve, 300);
      });
    },
    buttons: [
      {
        text: 'Back',
        action: function() {
          return this.back();
        }
      },
      {
        text: 'Next',
        action: function() {
          return this.next();
        }
      }
    ]
  },
  {
    id: 'dashboard',
    title: 'Dashboard',
    text: 'The dashboard provides an overview of your QA metrics, including agent performance, customer sentiment, and recent evaluations.',
    attachTo: {
      element: '.container-fluid',
      on: 'top'
    },
    buttons: [
      {
        text: 'Back',
        action: function() {
          return this.back();
        }
      },
      {
        text: 'Next',
        action: function() {
          return this.next();
        }
      }
    ]
  },
  {
    id: 'new-evaluation',
    title: 'Create New Evaluations',
    text: 'Use the New Evaluations page to search for and evaluate call recordings based on criteria profiles.',
    attachTo: {
      element: 'button',
      on: 'bottom'
    },
    beforeShowPromise: function() {
      // Find the first primary button on the dashboard
      const firstButtonSelector = document.querySelector('.btn.btn-primary');
      if (firstButtonSelector) {
        this.options.attachTo.element = firstButtonSelector;
      }
      return Promise.resolve();
    },
    buttons: [
      {
        text: 'Back',
        action: function() {
          return this.back();
        }
      },
      {
        text: 'Next',
        action: function() {
          return this.next();
        }
      }
    ]
  },
  {
    id: 'scheduler',
    title: 'Automated Scheduler',
    text: 'The Scheduler feature allows you to set up automated evaluations based on your criteria profiles. You can configure schedules to run daily, weekly, or at custom intervals.',
    attachTo: {
      element: 'body',
      on: 'center'
    },
    buttons: [
      {
        text: 'Back',
        action: function() {
          return this.back();
        }
      },
      {
        text: 'Next',
        action: function() {
          return this.next();
        }
      }
    ]
  },
  {
    id: 'analytics',
    title: 'Analytics & Reports',
    text: 'Use the Agent Comparison and Trend Analysis pages to gain insights into agent performance and track QA metrics over time.',
    attachTo: {
      element: 'body',
      on: 'center'
    },
    buttons: [
      {
        text: 'Back',
        action: function() {
          return this.back();
        }
      },
      {
        text: 'Finish Tour',
        action: function() {
          return this.complete();
        }
      }
    ]
  }
];

// Additional tour steps for specific sections of the app
const schedulerTourSteps = [
  {
    id: 'scheduler-welcome',
    title: 'Scheduler Dashboard',
    text: 'Welcome to the Scheduler Dashboard. This is where you can manage and monitor your automated evaluation schedules.',
    attachTo: {
      element: '.container-fluid',
      on: 'top'
    },
    buttons: [
      {
        text: 'Skip Tour',
        action: function() {
          return this.cancel();
        },
        classes: 'shepherd-button-secondary'
      },
      {
        text: 'Next',
        action: function() {
          return this.next();
        }
      }
    ]
  },
  {
    id: 'scheduler-profile',
    title: 'Scheduled Profiles',
    text: 'This table shows all your scheduled evaluation profiles with their configuration details and status.',
    attachTo: {
      element: '.card:first-child',
      on: 'bottom'
    },
    buttons: [
      {
        text: 'Back',
        action: function() {
          return this.back();
        }
      },
      {
        text: 'Next',
        action: function() {
          return this.next();
        }
      }
    ]
  },
  {
    id: 'scheduler-actions',
    title: 'Profile Actions',
    text: 'Use these buttons to edit a profile or manually run a scheduled evaluation.',
    attachTo: {
      element: '.btn-group',
      on: 'left'
    },
    beforeShowPromise: function() {
      const btnGroup = document.querySelector('.btn-group');
      if (btnGroup) {
        this.options.attachTo.element = btnGroup;
        return Promise.resolve();
      } else {
        return Promise.reject();
      }
    },
    buttons: [
      {
        text: 'Back',
        action: function() {
          return this.back();
        }
      },
      {
        text: 'Next',
        action: function() {
          return this.next();
        }
      }
    ]
  },
  {
    id: 'scheduler-stats',
    title: 'Statistics Cards',
    text: 'These cards show summary statistics about your scheduled profiles and their execution status.',
    attachTo: {
      element: '.row .card:first-child',
      on: 'top'
    },
    buttons: [
      {
        text: 'Back',
        action: function() {
          return this.back();
        }
      },
      {
        text: 'Finish Tour',
        action: function() {
          return this.complete();
        }
      }
    ]
  }
];

// Add steps for creating new evaluations
const newEvaluationTourSteps = [
  {
    id: 'new-eval-welcome',
    title: 'New Evaluations',
    text: 'This page lets you search for and evaluate call recordings. Let\'s go through the process.',
    attachTo: {
      element: '.container-fluid',
      on: 'top'
    },
    buttons: [
      {
        text: 'Skip Tour',
        action: function() {
          return this.cancel();
        },
        classes: 'shepherd-button-secondary'
      },
      {
        text: 'Next',
        action: function() {
          return this.next();
        }
      }
    ]
  },
  {
    id: 'new-eval-filters',
    title: 'Search Filters',
    text: 'Use these filters to find call recordings that match your criteria. You can filter by date, agent, queue, and more.',
    attachTo: {
      element: '.card:first-child',
      on: 'bottom'
    },
    buttons: [
      {
        text: 'Back',
        action: function() {
          return this.back();
        }
      },
      {
        text: 'Next',
        action: function() {
          return this.next();
        }
      }
    ]
  },
  {
    id: 'new-eval-qa-form',
    title: 'QA Form Selection',
    text: 'Select the QA Form that will be used to evaluate the calls. This determines the evaluation criteria and scoring.',
    attachTo: {
      element: 'select[name="qaFormId"]',
      on: 'bottom'
    },
    beforeShowPromise: function() {
      const formSelector = document.querySelector('select[name="qaFormId"]');
      if (formSelector) {
        this.options.attachTo.element = formSelector;
        return Promise.resolve();
      } else {
        // Try to find React Select component
        const reactSelect = document.querySelector('.form-control + div[class*="react-select"]');
        if (reactSelect) {
          this.options.attachTo.element = reactSelect;
          return Promise.resolve();
        }
        return Promise.reject();
      }
    },
    buttons: [
      {
        text: 'Back',
        action: function() {
          return this.back();
        }
      },
      {
        text: 'Finish Tour',
        action: function() {
          return this.complete();
        }
      }
    ]
  }
];

// Define tour service
class TourService {
  constructor() {
    this.mainTour = null;
    this.schedulerTour = null;
    this.newEvaluationTour = null;
    this.hasSeenTour = localStorage.getItem('hasSeenTour') === 'true';
  }

  initialize() {
    // Initialize main tour
    this.mainTour = new Shepherd.Tour(tourConfig);
    tourSteps.forEach(step => this.mainTour.addStep(step));

    // Initialize scheduler tour
    this.schedulerTour = new Shepherd.Tour({
      ...tourConfig,
      defaultStepOptions: {
        ...tourConfig.defaultStepOptions,
        classes: 'shepherd-theme-default shepherd-theme-scheduler'
      }
    });
    schedulerTourSteps.forEach(step => this.schedulerTour.addStep(step));

    // Initialize new evaluation tour
    this.newEvaluationTour = new Shepherd.Tour({
      ...tourConfig,
      defaultStepOptions: {
        ...tourConfig.defaultStepOptions,
        classes: 'shepherd-theme-default shepherd-theme-new-evaluation'
      }
    });
    newEvaluationTourSteps.forEach(step => this.newEvaluationTour.addStep(step));

    // Event handlers
    this.mainTour.on('complete', () => {
      this.markTourAsCompleted();
    });

    this.mainTour.on('cancel', () => {
      this.markTourAsCompleted();
    });
  }

  startMainTour() {
    if (!this.mainTour) {
      this.initialize();
    }
    this.mainTour.start();
  }

  startSchedulerTour() {
    if (!this.schedulerTour) {
      this.initialize();
    }
    this.schedulerTour.start();
  }

  startNewEvaluationTour() {
    if (!this.newEvaluationTour) {
      this.initialize();
    }
    this.newEvaluationTour.start();
  }

  markTourAsCompleted() {
    localStorage.setItem('hasSeenTour', 'true');
    this.hasSeenTour = true;
  }

  resetTour() {
    localStorage.removeItem('hasSeenTour');
    this.hasSeenTour = false;
  }

  shouldShowTour() {
    return !this.hasSeenTour;
  }
}

export default new TourService();
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
    arrow: true,
    // Add this to make the modal more visible
    modalOverlayOpeningPadding: 10,
    highlightClass: 'shepherd-highlight',
    // Fix dark modal background by ensuring proper styles
    popperOptions: {
      modifiers: [{
        name: 'offset',
        options: {
          offset: [0, 12]
        }
      }]
    }
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
    beforeShowPromise: function() {
      return new Promise(resolve => {
        // Check if the element exists before proceeding
        if (document.querySelector('.bg-light.border-end')) {
          resolve();
        } else {
          // Cancel this step if element doesn't exist
          this.cancel();
        }
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
    id: 'top-bar',
    title: 'Top Navigation Bar',
    text: 'The top bar shows the current page title and provides access to notifications, the evaluation queue, and your profile settings.',
    attachTo: {
      element: '.bg-white.border-bottom',
      on: 'bottom'
    },
    beforeShowPromise: function() {
      return new Promise(resolve => {
        // Check if the element exists before proceeding
        if (document.querySelector('.bg-white.border-bottom')) {
          resolve();
        } else {
          // Cancel this step if element doesn't exist
          this.cancel();
        }
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
    id: 'queue-monitor',
    title: 'Evaluation Queue',
    text: 'Monitor active evaluation jobs. Click this icon to see the status of all evaluation processes.',
    attachTo: {
      element: '.btn-light svg[data-icon="list-checks"]',
      on: 'bottom'
    },
    beforeShowPromise: function() {
      return new Promise(resolve => {
        // Give some time for the element to render, then check
        setTimeout(() => {
          if (document.querySelector('.btn-light svg[data-icon="list-checks"]')) {
            resolve();
          } else {
            // Cancel this step if element doesn't exist
            this.cancel();
          }
        }, 300);
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
    beforeShowPromise: function() {
      return new Promise(resolve => {
        // Check if we're on the dashboard page
        if (window.location.pathname.includes('/dashboard') && 
            document.querySelector('.container-fluid')) {
          resolve();
        } else {
          // Cancel this step if not on dashboard
          this.cancel();
        }
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
    id: 'new-evaluation',
    title: 'Create New Evaluations',
    text: 'Use the New Evaluations page to search for and evaluate call recordings based on criteria profiles.',
    attachTo: {
      element: 'button',
      on: 'bottom'
    },
    beforeShowPromise: function() {
      return new Promise(resolve => {
        // Find the first primary button on the dashboard
        const firstButtonSelector = document.querySelector('.btn.btn-primary');
        if (firstButtonSelector) {
          this.options.attachTo.element = firstButtonSelector;
          resolve();
        } else {
          // Cancel this step if button not found
          this.cancel();
        }
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
    beforeShowPromise: function() {
      return new Promise(resolve => {
        // Check if we're on the scheduler page
        if (window.location.pathname.includes('/scheduler') && 
            document.querySelector('.container-fluid')) {
          resolve();
        } else {
          // Cancel this step if not on scheduler page
          this.cancel();
        }
      });
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
    beforeShowPromise: function() {
      return new Promise(resolve => {
        if (document.querySelector('.card:first-child')) {
          resolve();
        } else {
          this.cancel();
        }
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
    id: 'scheduler-actions',
    title: 'Profile Actions',
    text: 'Use these buttons to edit a profile or manually run a scheduled evaluation.',
    attachTo: {
      element: '.btn-group',
      on: 'left'
    },
    beforeShowPromise: function() {
      return new Promise(resolve => {
        const btnGroup = document.querySelector('.btn-group');
        if (btnGroup) {
          this.options.attachTo.element = btnGroup;
          resolve();
        } else {
          this.cancel();
        }
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
    id: 'scheduler-stats',
    title: 'Statistics Cards',
    text: 'These cards show summary statistics about your scheduled profiles and their execution status.',
    attachTo: {
      element: '.row .card:first-child',
      on: 'top'
    },
    beforeShowPromise: function() {
      return new Promise(resolve => {
        if (document.querySelector('.row .card:first-child')) {
          resolve();
        } else {
          this.cancel();
        }
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
    beforeShowPromise: function() {
      return new Promise(resolve => {
        // Check if we're on the new evaluations page
        if (window.location.pathname.includes('/new-evaluations') && 
            document.querySelector('.container-fluid')) {
          resolve();
        } else {
          // Cancel this step if not on new evaluations page
          this.cancel();
        }
      });
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
    beforeShowPromise: function() {
      return new Promise(resolve => {
        if (document.querySelector('.card:first-child')) {
          resolve();
        } else {
          this.cancel();
        }
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
    id: 'new-eval-qa-form',
    title: 'QA Form Selection',
    text: 'Select the QA Form that will be used to evaluate the calls. This determines the evaluation criteria and scoring.',
    attachTo: {
      element: 'select[name="qaFormId"]',
      on: 'bottom'
    },
    beforeShowPromise: function() {
      return new Promise(resolve => {
        const formSelector = document.querySelector('select[name="qaFormId"]');
        if (formSelector) {
          this.options.attachTo.element = formSelector;
          resolve();
        } else {
          // Try to find React Select component
          const reactSelect = document.querySelector('.form-control + div[class*="react-select"]');
          if (reactSelect) {
            this.options.attachTo.element = reactSelect;
            resolve();
          } else {
            this.cancel();
          }
        }
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

    // Add error handling for when a step's target element doesn't exist
    this.mainTour.on('error', () => {
      console.log('Tour error occurred - likely missing element');
      this.mainTour.next();
    });

    this.schedulerTour.on('error', () => {
      console.log('Scheduler tour error occurred');
      this.schedulerTour.next();
    });

    this.newEvaluationTour.on('error', () => {
      console.log('New evaluation tour error occurred');
      this.newEvaluationTour.next();
    });
  }

  startMainTour() {
    if (!this.mainTour) {
      this.initialize();
    }
    
    // Check if we're on the dashboard page before starting the tour
    if (window.location.pathname.includes('/dashboard')) {
      this.mainTour.start();
    } else {
      console.log('Main tour can only be started from the dashboard page');
      // Optionally navigate to dashboard first
      // window.location.href = '/dashboard';
    }
  }

  startSchedulerTour() {
    if (!this.schedulerTour) {
      this.initialize();
    }
    
    // Check if we're on the scheduler page before starting the tour
    if (window.location.pathname.includes('/scheduler')) {
      this.schedulerTour.start();
    } else {
      console.log('Scheduler tour can only be started from the scheduler page');
    }
  }

  startNewEvaluationTour() {
    if (!this.newEvaluationTour) {
      this.initialize();
    }
    
    // Check if we're on the new evaluations page before starting the tour
    if (window.location.pathname.includes('/new-evaluations')) {
      this.newEvaluationTour.start();
    } else {
      console.log('New evaluation tour can only be started from the new evaluations page');
    }
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
// MongoDB migration script for the default QA Form
// This can be run during new installations to create the default evaluation form

const { MongoClient, ObjectId } = require('mongodb');
require('dotenv').config();

// MongoDB connection string - update with your actual connection string
const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/cc_dispatch_db';

async function createDefaultQAForm() {
  const client = new MongoClient(uri);

  try {
    await client.connect();
    console.log('Connected to MongoDB');

    const database = client.db();
    const forms = database.collection('aiqaforms');

    // Check if default form already exists
    const existingForm = await forms.findOne({ name: 'Comprehensive Call Quality Assessment' });
    
    if (existingForm) {
      console.log('Default QA form already exists. Skipping creation.');
      return;
    }

    // Create the default QA form document
    const defaultQAForm = {
      name: 'Comprehensive Call Quality Assessment',
      description: 'Standard evaluation form for assessing agent performance across key customer service metrics',
      isActive: true,
      moderationRequired: true,
      
      // Define form groups - just use a single default group
      groups: [
        { id: 'default', name: 'Default Group' }
      ],
      
      // Define classification impact definitions
      classifications: [
        { 
          type: 'none', 
          impactPercentage: 0, 
          description: 'No classification has no impact on the score.'
        },
        { 
          type: 'minor', 
          impactPercentage: 10, 
          description: 'Minor issues have a small impact on quality and deduct 10% of the section\'s possible score.'
        },
        { 
          type: 'moderate', 
          impactPercentage: 25, 
          description: 'Moderate issues have a significant impact on quality and deduct 25% of the section\'s possible score.'
        },
        { 
          type: 'major', 
          impactPercentage: 50, 
          description: 'Major issues have a critical impact on quality and deduct 50% of the section\'s possible score.'
        }
      ],
      
      // Define parameters (questions) - all assigned to the default group
      parameters: [
        {
          name: 'Proper Greeting',
          description: 'Assessment of the agent\'s initial greeting',
          context: 'Agent should greet the customer professionally with a complete greeting that includes identifying themselves and the company. Assess whether the agent provided a warm, professional greeting that follows company standards (e.g., "Thank you for calling [Company Name], my name is [Agent Name]. How may I help you today?"). Appropriate greeting should be provided within the first 10 seconds of the call.',
          maxScore: 5,
          scoringType: 'variable',
          order: 1,
          group: 'default',
          classification: 'none'
        },
        {
          name: 'Identity Verification',
          description: 'Assessment of proper identity verification procedures',
          context: 'Agent must properly verify the caller\'s identity according to company policy before discussing account details or making changes. This must include at least two forms of verification (e.g., account number, phone number, email address, security questions). Give full points if verification was properly completed, zero if verification was incomplete or skipped when required.',
          maxScore: 5,
          scoringType: 'binary',
          order: 2,
          group: 'default',
          classification: 'none'
        },
        {
          name: 'Demonstrated Understanding',
          description: 'Assessment of agent\'s active listening skills',
          context: 'Agent should demonstrate active listening by paraphrasing the customer\'s concerns, asking clarifying questions, and confirming understanding throughout the call. Agent should not interrupt the customer inappropriately. Higher scores reflect better demonstration of understanding and fewer misinterpretations of customer needs.',
          maxScore: 5,
          scoringType: 'variable',
          order: 3,
          group: 'default',
          classification: 'none'
        },
        {
          name: 'Attention to Detail',
          description: 'Assessment of agent\'s attention to important details',
          context: 'Agent should pay attention to all details provided by the customer and capture important information accurately. This includes noting specific dates, amounts, preferences, and other relevant details. Higher scores indicate better attention to detail with fewer instances of requiring the customer to repeat information.',
          maxScore: 5,
          scoringType: 'variable',
          order: 4,
          group: 'default',
          classification: 'none'
        },
        {
          name: 'Solution Appropriateness',
          description: 'Assessment of the appropriateness of provided solutions',
          context: 'Evaluate whether the agent provided solutions that appropriately addressed the customer\'s specific needs and concerns. Solutions should be relevant, complete, and align with company policies. Higher scores reflect better tailored solutions that fully address the customer\'s needs.',
          maxScore: 10,
          scoringType: 'variable',
          order: 5,
          group: 'default',
          classification: 'none'
        },
        {
          name: 'Knowledge Demonstration',
          description: 'Assessment of agent\'s product and service knowledge',
          context: 'Agent should demonstrate thorough knowledge of products, services, policies, and procedures. They should provide accurate information without excessive hold times for research. Consider the complexity of the issue when scoring. Higher scores reflect better knowledge demonstration and fewer inaccuracies.',
          maxScore: 10,
          scoringType: 'variable',
          order: 6,
          group: 'default',
          classification: 'none'
        },
        {
          name: 'Efficiency',
          description: 'Assessment of agent\'s efficiency in handling the call',
          context: 'Agent should resolve the customer\'s issue efficiently without unnecessary steps or delays. Consider appropriate use of systems, tools, and resources. Score higher for more efficient handling that respects the customer\'s time while still resolving the issue thoroughly.',
          maxScore: 10,
          scoringType: 'variable',
          order: 7,
          group: 'default',
          classification: 'none'
        },
        {
          name: 'Clear Explanation',
          description: 'Assessment of clarity in agent\'s explanations',
          context: 'Agent should communicate clearly using appropriate vocabulary, avoiding jargon or overly technical terms unless speaking with a technically proficient customer. Explanations should be concise yet complete. Score higher for clearer explanations that the customer obviously understood.',
          maxScore: 5,
          scoringType: 'variable',
          order: 8,
          group: 'default',
          classification: 'none'
        },
        {
          name: 'Proper Language & Grammar',
          description: 'Assessment of agent\'s language and grammar usage',
          context: 'Agent should use proper language, grammar, and pronunciation throughout the call. They should speak at an appropriate pace and volume. Score higher for better language usage with fewer grammatical errors or speech issues.',
          maxScore: 5,
          scoringType: 'variable',
          order: 9,
          group: 'default',
          classification: 'none'
        },
        {
          name: 'Empathy Demonstration',
          description: 'Assessment of agent\'s empathy toward customer',
          context: 'Agent should demonstrate appropriate empathy for the customer\'s situation, particularly if the customer is experiencing difficulties or frustration. They should acknowledge emotions appropriately without overreacting. Score higher for better demonstrations of genuine empathy.',
          maxScore: 5,
          scoringType: 'variable',
          order: 10,
          group: 'default',
          classification: 'none'
        },
        {
          name: 'Professional Demeanor',
          description: 'Assessment of agent\'s professional attitude',
          context: 'Agent should maintain a professional, courteous demeanor throughout the call, even if the customer becomes difficult. They should avoid defensiveness, rudeness, or inappropriate comments. Score higher for consistently professional behavior regardless of call circumstances.',
          maxScore: 5,
          scoringType: 'variable',
          order: 11,
          group: 'default',
          classification: 'none'
        },
        {
          name: 'Regulatory Compliance',
          description: 'Assessment of agent\'s regulatory compliance',
          context: 'Agent must adhere to all relevant regulatory requirements, including privacy laws, disclosure requirements, and other compliance mandates. Any compliance failure is serious. Give full points only if all compliance requirements are met, zero points for any compliance failures.',
          maxScore: 5,
          scoringType: 'binary',
          order: 12,
          group: 'default',
          classification: 'none'
        },
        {
          name: 'Company Policy Adherence',
          description: 'Assessment of agent\'s adherence to company policies',
          context: 'Agent should follow all company policies and procedures throughout the call. This includes authentication processes, escalation procedures, call handling guidelines, and documentation requirements. Score higher for better adherence to policies with fewer deviations.',
          maxScore: 5,
          scoringType: 'variable',
          order: 13,
          group: 'default',
          classification: 'none'
        },
        {
          name: 'Proper Closing',
          description: 'Assessment of call closing procedures',
          context: 'Agent should provide a proper closing to the call, including summarizing what was discussed and what actions will be taken, confirming the customer has no further questions, thanking the customer, and providing an appropriate farewell. Score higher for more complete closings.',
          maxScore: 5,
          scoringType: 'variable',
          order: 14,
          group: 'default',
          classification: 'none'
        },
        {
          name: 'Documentation Quality',
          description: 'Assessment of call documentation quality',
          context: 'Agent should properly document the call in the system, including accurate summary notes, action items, resolution details, and any follow-up requirements. Documentation should be thorough enough that another agent could understand the interaction if the customer calls back. Score based on completeness and accuracy of documentation.',
          maxScore: 5,
          scoringType: 'variable',
          order: 15,
          group: 'default',
          classification: 'none'
        }
      ],
      
      // Add metadata
      createdBy: 'system',
      updatedBy: 'system',
      createdAt: new Date(),
      updatedAt: new Date()
    };

    // Insert the form into the collection
    const result = await forms.insertOne(defaultQAForm);
    console.log(`Default QA form created with ID: ${result.insertedId}`);

    // Optional: Create indexes for better query performance
    await forms.createIndex({ name: 1 }, { unique: true });
    await forms.createIndex({ isActive: 1 });

  } catch (error) {
    console.error('Error creating default QA form:', error);
  } finally {
    await client.close();
    console.log('MongoDB connection closed');
  }
}

// Run the migration
createDefaultQAForm()
  .then(() => console.log('Migration completed'))
  .catch(err => console.error('Migration failed:', err));

// To run this script:
// 1. Save as create-default-qa-form.js
// 2. Run with: node create-default-qa-form.js
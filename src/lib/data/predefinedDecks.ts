import type { Actor } from '$lib/types';
import { generateId } from '$lib/services/gunService';

// These are template actors that get processed when added to a game
// They don't need to exactly match the Actor interface since they're templates
// that will be processed into proper Actor objects when added to a game
type ActorTemplate = Partial<Actor> & {
    actor_id: string;
    created_at?: number;
    // Additional fields used in templates that aren't in final Actor objects
    role_title?: string; 
    backstory?: string;
    values?: string[] | Record<string, boolean>;
    capabilities?: string[] | Record<string, boolean>;
    goals?: string | string[];
    skills?: string[];
    resources?: string[];
    constraints?: string[];
};

// Eco-Village role cards
export const ecoVillageDeck: ActorTemplate[] = [
    {
        actor_id: `actor-farmer-${generateId()}`,
        role_title: "Eco Farmer",
        backstory: "You have years of experience with organic farming methods and agroecology practices. You understand the soil, seasons, and sustainable growing techniques.",
        values: [
            "Environmental sustainability",
            "Food sovereignty",
            "Biodiversity conservation"
        ],
        goals: [
            "Develop a sustainable food production system for the eco-village",
            "Implement permaculture design for multiple growing areas",
            "Establish seed saving and local variety development"
        ],
        skills: [
            "Organic farming",
            "Permaculture design",
            "Seed saving",
            "Agroforestry"
        ],
        resources: [
            "Heirloom seed collection",
            "Farming tools",
            "Knowledge of local growing conditions"
        ],
        constraints: [
            "Needs sufficient land and water access",
            "Sensitive to pollution and pesticide use",
            "Requires community labor for harvest seasons"
        ]
    },
    {
        actor_id: `actor-builder-${generateId()}`,
        role_title: "Natural Builder",
        backstory: "You've pioneered ecological building techniques using earth, straw, timber, and other natural materials. You design structures that harmonize with nature.",
        values: [
            "Ecological building methods",
            "Self-sufficient housing",
            "Energy efficiency"
        ],
        goals: [
            "Design and construct homes using natural, local materials",
            "Create community spaces that balance privacy and shared resources",
            "Implement water and energy systems that minimize external inputs"
        ],
        skills: [
            "Natural building (cob, straw bale, timber framing)",
            "Passive solar design",
            "Rainwater harvesting systems",
            "Earth plaster and natural finishes"
        ],
        resources: [
            "Building tools",
            "Architectural designs for eco-homes",
            "Connections to material suppliers"
        ],
        constraints: [
            "Building season limited by weather",
            "Material sourcing must align with ecological values",
            "Code compliance can be challenging for alternative methods"
        ]
    },
    {
        actor_id: `actor-funder-${generateId()}`,
        role_title: "Eco-Village Funder",
        backstory: "You've spent your career in finance but have become passionate about redirecting capital towards regenerative projects. You have investment resources to contribute.",
        values: [
            "Regenerative economics",
            "Financial accessibility",
            "Long-term sustainability"
        ],
        goals: [
            "Create a viable economic model for the eco-village",
            "Ensure project has sufficient capital to develop infrastructure",
            "Design innovative systems of ownership and cost-sharing"
        ],
        skills: [
            "Financial planning",
            "Investment management",
            "Fundraising",
            "Business development"
        ],
        resources: [
            "Investment capital",
            "Network of potential donors/investors",
            "Knowledge of alternative financing models"
        ],
        constraints: [
            "Needs viable projects with defined outcomes",
            "Must balance financial sustainability with social mission",
            "Risk management requires due diligence processes"
        ]
    },
    {
        actor_id: `actor-commorg-${generateId()}`,
        role_title: "Community Organizer",
        backstory: "You have extensive experience facilitating groups and building consensus. You understand the human dynamics that can make or break community projects.",
        values: [
            "Inclusive decision-making",
            "Social justice",
            "Collective wellbeing"
        ],
        goals: [
            "Develop governance systems that balance efficiency and participation",
            "Create conflict resolution processes that strengthen relationships",
            "Foster a culture of cooperation and mutual support"
        ],
        skills: [
            "Facilitation",
            "Consensus building",
            "Conflict resolution",
            "Event organization"
        ],
        resources: [
            "Network of community contacts",
            "Experience with various governance models",
            "Tools for participatory decision-making"
        ],
        constraints: [
            "Community processes take time and energy",
            "Must balance diverse perspectives and needs",
            "Emotional labor can lead to burnout"
        ]
    },
    {
        actor_id: `actor-tech-${generateId()}`,
        role_title: "Appropriate Technologist",
        backstory: "You're passionate about technology that serves human and ecological needs. You work at the intersection of innovation and sustainability.",
        values: [
            "Appropriate technology",
            "Open source sharing",
            "Energy efficiency"
        ],
        goals: [
            "Design and implement renewable energy systems",
            "Create appropriate tech solutions for village infrastructure",
            "Develop skills sharing programs for technological self-sufficiency"
        ],
        skills: [
            "Renewable energy systems",
            "Water purification",
            "Electronics and repair",
            "Off-grid systems design"
        ],
        resources: [
            "Technical tools and equipment",
            "Design software",
            "Connections to tech/maker communities"
        ],
        constraints: [
            "Materials availability for remote locations",
            "Technical solutions must be maintainable by community",
            "Energy systems have weather dependencies"
        ]
    }
];

// Community Garden role cards
export const communityGardenDeck: ActorTemplate[] = [
    {
        actor_id: `actor-coordinator-${generateId()}`,
        role_title: "Garden Coordinator",
        backstory: "You have experience managing community projects and a passion for urban agriculture. You bring people together around shared green spaces.",
        values: [
            "Community involvement",
            "Food accessibility",
            "Urban greening"
        ],
        goals: [
            "Create a thriving garden space that serves diverse community needs",
            "Develop sustainable garden management systems",
            "Build strong relationships among garden participants"
        ],
        skills: [
            "Project management",
            "Volunteer coordination",
            "Fundraising",
            "Conflict resolution"
        ],
        resources: [
            "Community connections",
            "Organizational tools",
            "Knowledge of local regulations"
        ],
        constraints: [
            "Limited time as volunteer position",
            "Must balance diverse community interests",
            "Administrative responsibilities can be demanding"
        ]
    },
    {
        actor_id: `actor-master-gardener-${generateId()}`,
        role_title: "Master Gardener",
        backstory: "Your lifelong passion for plants has given you extensive knowledge of growing in various conditions. You love sharing your expertise with others.",
        values: [
            "Ecological growing methods",
            "Plant diversity",
            "Knowledge sharing"
        ],
        goals: [
            "Implement sustainable growing systems in the garden",
            "Teach gardening skills to community members",
            "Maximize food production in limited urban space"
        ],
        skills: [
            "Organic gardening",
            "Plant selection and care",
            "Soil management",
            "Pest management"
        ],
        resources: [
            "Seeds and plant starts",
            "Gardening tools",
            "Reference materials"
        ],
        constraints: [
            "Seasonal availability",
            "Urban growing challenges (pollution, space)",
            "Balancing productivity with learning opportunities"
        ]
    },
    {
        actor_id: `actor-neighbor-${generateId()}`,
        role_title: "Neighborhood Resident",
        backstory: "You've lived in the neighborhood for years and have seen many changes. You're interested in the garden as a way to improve local quality of life.",
        values: [
            "Neighborhood beautification",
            "Community safety",
            "Local food access"
        ],
        goals: [
            "Create a safe, beautiful space for community gathering",
            "Grow food for personal use and possibly sharing",
            "Connect with neighbors through garden activities"
        ],
        skills: [
            "Local knowledge",
            "Some growing experience",
            "Community connections"
        ],
        resources: [
            "Time to participate regularly",
            "Personal tools to contribute",
            "Home kitchen for processing garden products"
        ],
        constraints: [
            "Limited gardening knowledge",
            "Physical abilities may vary",
            "May have scheduling constraints"
        ]
    },
    {
        actor_id: `actor-educator-${generateId()}`,
        role_title: "Education Coordinator",
        backstory: "You have a background in environmental education and see the garden as an opportunity for community learning and youth development.",
        values: [
            "Experiential education",
            "Intergenerational learning",
            "Environmental awareness"
        ],
        goals: [
            "Develop education programs for various community groups",
            "Create signage and materials to facilitate learning",
            "Build partnerships with local schools and organizations"
        ],
        skills: [
            "Curriculum development",
            "Teaching",
            "Program design",
            "Partnership building"
        ],
        resources: [
            "Educational materials",
            "Teaching experience",
            "Connections to educational institutions"
        ],
        constraints: [
            "Program funding needs",
            "Balancing education with garden productivity",
            "Volunteer teacher availability"
        ]
    }
];

// Function to get a predefined deck based on deck type
// We return ActorTemplate[] which will be processed into proper Actor objects when added to a game
export function getPredefinedDeck(deckType: string): ActorTemplate[] {
    switch (deckType) {
        case 'eco-village':
            return ecoVillageDeck;
        case 'community-garden':
            return communityGardenDeck;
        default:
            console.warn(`Deck type "${deckType}" not found. Defaulting to eco-village.`);
            return ecoVillageDeck;
    }
}
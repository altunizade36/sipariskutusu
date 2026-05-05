import AsyncStorage from '@react-native-async-storage/async-storage';

export type FeedbackType = 'bug' | 'feature' | 'improvement' | 'other';
export type FeedbackRating = 1 | 2 | 3 | 4 | 5;

export interface Feedback {
  id: string;
  type: FeedbackType;
  rating?: FeedbackRating;
  title: string;
  description: string;
  attachments?: string[];
  timestamp: number;
  userId?: string;
  status: 'new' | 'acknowledged' | 'resolved';
  email?: string;
}

const FEEDBACK_KEY = '@sipariskutusu/feedback';

export class FeedbackService {
  static async submitFeedback(
    type: FeedbackType,
    title: string,
    description: string,
    rating?: FeedbackRating,
    email?: string,
  ): Promise<Feedback> {
    try {
      const feedback: Feedback = {
        id: `feedback_${Date.now()}`,
        type,
        title,
        description,
        rating,
        timestamp: Date.now(),
        status: 'new',
        email,
      };

      const allFeedback = await this.getAllFeedback();
      allFeedback.push(feedback);

      await AsyncStorage.setItem(FEEDBACK_KEY, JSON.stringify(allFeedback));
      return feedback;
    } catch (error) {
      console.error('Failed to submit feedback:', error);
      throw error;
    }
  }

  static async getAllFeedback(): Promise<Feedback[]> {
    try {
      const data = await AsyncStorage.getItem(FEEDBACK_KEY);
      return data ? JSON.parse(data) : [];
    } catch (error) {
      console.error('Failed to get feedback:', error);
      return [];
    }
  }

  static async getFeedbackById(id: string): Promise<Feedback | null> {
    try {
      const allFeedback = await this.getAllFeedback();
      return allFeedback.find((f) => f.id === id) || null;
    } catch (error) {
      console.error('Failed to get feedback by id:', error);
      return null;
    }
  }

  static async updateFeedbackStatus(id: string, status: Feedback['status']): Promise<boolean> {
    try {
      const allFeedback = await this.getAllFeedback();
      const feedback = allFeedback.find((f) => f.id === id);
      
      if (!feedback) return false;

      feedback.status = status;
      await AsyncStorage.setItem(FEEDBACK_KEY, JSON.stringify(allFeedback));
      return true;
    } catch (error) {
      console.error('Failed to update feedback status:', error);
      return false;
    }
  }

  static async getFeedbackByType(type: FeedbackType): Promise<Feedback[]> {
    try {
      const allFeedback = await this.getAllFeedback();
      return allFeedback.filter((f) => f.type === type);
    } catch (error) {
      console.error('Failed to get feedback by type:', error);
      return [];
    }
  }

  static async getAverageRating(): Promise<number> {
    try {
      const allFeedback = await this.getAllFeedback();
      const rated = allFeedback.filter((f) => f.rating);
      
      if (rated.length === 0) return 0;

      const sum = rated.reduce((acc, f) => acc + (f.rating || 0), 0);
      return sum / rated.length;
    } catch (error) {
      console.error('Failed to get average rating:', error);
      return 0;
    }
  }

  static async getStats(): Promise<{
    total: number;
    byType: Record<FeedbackType, number>;
    averageRating: number;
    newCount: number;
  }> {
    try {
      const allFeedback = await this.getAllFeedback();
      const byType = {
        bug: 0,
        feature: 0,
        improvement: 0,
        other: 0,
      };

      allFeedback.forEach((f) => {
        byType[f.type]++;
      });

      const averageRating = await this.getAverageRating();
      const newCount = allFeedback.filter((f) => f.status === 'new').length;

      return {
        total: allFeedback.length,
        byType,
        averageRating,
        newCount,
      };
    } catch (error) {
      console.error('Failed to get feedback stats:', error);
      return {
        total: 0,
        byType: { bug: 0, feature: 0, improvement: 0, other: 0 },
        averageRating: 0,
        newCount: 0,
      };
    }
  }

  static async deleteFeedback(id: string): Promise<boolean> {
    try {
      const allFeedback = await this.getAllFeedback();
      const filtered = allFeedback.filter((f) => f.id !== id);
      await AsyncStorage.setItem(FEEDBACK_KEY, JSON.stringify(filtered));
      return true;
    } catch (error) {
      console.error('Failed to delete feedback:', error);
      return false;
    }
  }

  static async clearAllFeedback(): Promise<void> {
    try {
      await AsyncStorage.removeItem(FEEDBACK_KEY);
    } catch (error) {
      console.error('Failed to clear feedback:', error);
    }
  }
}

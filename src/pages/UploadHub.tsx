import React from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  MessageSquare,
  Send,
  Mail,
  Smartphone,
  ScrollText,
  Files,
  FileImage,
  FolderOpen,
  ArrowRight
} from 'lucide-react';

import { useThemeStore, useImportStore } from '@/lib/store';
import { cn } from '@/lib/utils';
import { Card } from '@/components/ui/Card';
import { PageHeader } from '@/components/ui/PageHeader';

export default function UploadHub() {
  const navigate = useNavigate();
  const { isDarkMode } = useThemeStore();
  const { messages } = useImportStore();
  
  const sources = [
    {
      id: 'whatsapp',
      name: 'WhatsApp',
      icon: MessageSquare,
      formats: '.txt, .zip',
      description: 'Exported chat conversations from groups or individuals',
      route: '/upload/whatsapp',
      color: 'text-green-500',
      bgColor: 'bg-green-500/10'
    },
    {
      id: 'telegram',
      name: 'Telegram',
      icon: Send,
      formats: 'JSON, HTML',
      description: 'Desktop chat exports and message histories',
      route: '/upload/telegram',
      color: 'text-sky-500',
      bgColor: 'bg-sky-500/10'
    },
    {
      id: 'gmail',
      name: 'Gmail',
      icon: Mail,
      formats: 'OAuth / IMAP',
      description: 'Connect and fetch important emails automatically',
      route: '/upload/gmail',
      color: 'text-red-500',
      bgColor: 'bg-red-500/10'
    },
    {
      id: 'sms',
      name: 'SMS',
      icon: Smartphone,
      formats: 'CSV, JSON, TXT',
      description: 'SMS backup files from your mobile device',
      route: '/upload/sms',
      color: 'text-indigo-500',
      bgColor: 'bg-indigo-500/10'
    },
    {
      id: 'circulars',
      name: 'Circulars',
      icon: ScrollText,
      formats: 'PDF, Images',
      description: 'College notices, official announcements, and bulletins',
      route: '/upload/circulars',
      color: 'text-amber-500',
      bgColor: 'bg-amber-500/10'
    },
    {
      id: 'documents',
      name: 'Documents',
      icon: Files,
      formats: 'PDF, TXT, CSV, DOCX',
      description: 'Various document formats containing unstructured data',
      route: '/upload/documents',
      color: 'text-blue-500',
      bgColor: 'bg-blue-500/10'
    },
    {
      id: 'images',
      name: 'Images',
      icon: FileImage,
      formats: 'JPG, PNG, WebP',
      description: 'Screenshots and photos for text extraction (OCR)',
      route: '/upload/images',
      color: 'text-purple-500',
      bgColor: 'bg-purple-500/10'
    },
    {
      id: 'other',
      name: 'Other',
      icon: FolderOpen,
      formats: 'Various',
      description: 'Other files, custom formats, and pasted raw text',
      route: '/upload/other',
      color: 'text-gray-500',
      bgColor: 'bg-gray-500/10'
    }
  ];

  const containerVariants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: { staggerChildren: 0.05 }
    }
  };

  const itemVariants = {
    hidden: { y: 20, opacity: 0 },
    show: { y: 0, opacity: 1 }
  };

  return (
    <div className="space-y-6 pb-12">
      <PageHeader 
        title="Import Sources" 
        description="Select a source to upload your data. All processing happens locally on your device for maximum privacy."
      />

      {messages.length > 0 && (
        <Card className="p-4 mb-6 bg-accent/10 border-accent/20 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-accent/20 rounded-full text-accent">
              <Files className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-medium">Pending Imports</h3>
              <p className="text-sm text-secondary">{messages.length} messages ready for analysis</p>
            </div>
          </div>
          <button 
            onClick={() => navigate('/analysis')}
            className="flex items-center text-sm font-medium text-accent hover:underline"
          >
            Go to Analysis <ArrowRight className="ml-1 w-4 h-4" />
          </button>
        </Card>
      )}

      <motion.div 
        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
        variants={containerVariants}
        initial="hidden"
        animate="show"
      >
        {sources.map((source) => (
          <motion.div key={source.id} variants={itemVariants}>
            <Card 
              className={cn(
                "p-6 h-full cursor-pointer transition-all duration-200 group flex flex-col",
                "hover:shadow-md hover:border-accent/50",
                isDarkMode ? "bg-panel" : "bg-card"
              )}
              onClick={() => navigate(source.route)}
            >
              <div className="flex items-start justify-between mb-4">
                <div className={cn("p-3 rounded-xl", source.bgColor, source.color)}>
                  <source.icon className="w-6 h-6" />
                </div>
                <div className="text-xs font-mono px-2 py-1 bg-secondary/10 text-secondary rounded-md">
                  {source.formats}
                </div>
              </div>
              
              <h3 className="text-xl font-semibold mb-2 group-hover:text-accent transition-colors">
                {source.name}
              </h3>
              
              <p className="text-secondary text-sm flex-grow mb-4">
                {source.description}
              </p>
              
              <div className="flex items-center text-sm font-medium text-secondary group-hover:text-accent mt-auto pt-2 border-t border-border/50 transition-colors">
                Select Source <ArrowRight className="ml-2 w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </div>
            </Card>
          </motion.div>
        ))}
      </motion.div>
    </div>
  );
}

//
// (C) Copyright 2003-2017 by Autodesk, Inc.
//
// Permission to use, copy, modify, and distribute this software in
// object code form for any purpose and without fee is hereby granted,
// provided that the above copyright notice appears in all copies and
// that both that copyright notice and the limited warranty and
// restricted rights notice below appear in all supporting
// documentation.
//
// AUTODESK PROVIDES THIS PROGRAM "AS IS" AND WITH ALL FAULTS.
// AUTODESK SPECIFICALLY DISCLAIMS ANY IMPLIED WARRANTY OF
// MERCHANTABILITY OR FITNESS FOR A PARTICULAR USE. AUTODESK, INC.
// DOES NOT WARRANT THAT THE OPERATION OF THE PROGRAM WILL BE
// UNINTERRUPTED OR ERROR FREE.
//
// Use, duplication, or disclosure by the U.S. Government is subject to
// restrictions set forth in FAR 52.227-19 (Commercial Computer
// Software - Restricted Rights) and DFAR 252.227-7013(c)(1)(ii)
// (Rights in Technical Data and Computer Software), as applicable.
//

using System;
using Autodesk.Revit;

namespace Autodesk.APS.RevitIO.CreateWindow
{
    /// <summary>
    /// The class is used to create window wizard form
    /// </summary>
    public class WindowWizard
    {
        /// <summary>
        /// store the WizardParameter
        /// </summary>
        private WizardParameter m_para;
        
        /// <summary>
        /// store the WindowCreation
        /// </summary>
        private WindowCreation m_winCreator;

        /// <summary>
        /// store the ExternalCommandData
        /// </summary>
        private CreateWindowData m_commandData;

        /// <summary>
        /// constructor of WindowWizard
        /// </summary>
        /// <param name="commandData">the ExternalCommandData parameter</param>
        public WindowWizard(CreateWindowData commandData)
        {
            m_commandData = commandData;
        }

        /// <summary>
        /// the method is used to show wizard form and do the creation
        /// </summary>
        /// <returns>the process result</returns>
        public bool RunWizard()
        {
            // For Window Family Creation workItem
            WindowsDAParams windowFamilyParams;
            windowFamilyParams = WindowsDAParams.Parse("WindowParams.json");

            m_para = new WizardParameter();
            m_para.m_template = windowFamilyParams.WindowStyle;

            if (m_para.m_template.Equals("DoubleHungWindow", StringComparison.CurrentCultureIgnoreCase))
            {
                m_winCreator = new DoubleHungWinCreation(m_para, m_commandData);
                foreach (TypeDAParams type in windowFamilyParams.Types)
                {
                    DoubleHungWinPara dbhungWinPara = new DoubleHungWinPara(m_para.Validator.IsMetric);
                    // Values are expected in Revit internal units (ft). If payload
                    // declares a different unit, convert to internal.
                    dbhungWinPara.Height = ConvertToInternal(type.WindowHeight, windowFamilyParams.unitsContext);
                    dbhungWinPara.Width = ConvertToInternal(type.WindowWidth, windowFamilyParams.unitsContext);
                    dbhungWinPara.Inset = ConvertToInternal(type.WindowInset, windowFamilyParams.unitsContext);
                    dbhungWinPara.SillHeight = ConvertToInternal(type.WindowSillHeight, windowFamilyParams.unitsContext);
                    dbhungWinPara.Type = type.TypeName;
                    m_para.CurrentPara = dbhungWinPara;
                    if (!m_para.WinParaTab.Contains(dbhungWinPara.Type))
                    {
                        m_para.WinParaTab.Add(dbhungWinPara.Type, dbhungWinPara);
                    }
                    else
                    {
                        m_para.WinParaTab[dbhungWinPara.Type] = dbhungWinPara;
                    }
                }
                m_para.GlassMat = windowFamilyParams.GlassPaneMaterial;
                m_para.SashMat = windowFamilyParams.SashMaterial;
            }
            else if(m_para.m_template == "SlidingDoubleWindow")
            {
                m_winCreator = new SlidingDoubleWinCreation(m_para, m_commandData);
                // TBD: Collect the params of Sliding Double window
                foreach (TypeDAParams type in windowFamilyParams.Types)
                {
                    SlidingDoubleWinPara slidingDoubleWinPara = new SlidingDoubleWinPara(m_para.Validator.IsMetric);
                    slidingDoubleWinPara.Height = ConvertToInternal(type.WindowHeight, windowFamilyParams.unitsContext);
                    slidingDoubleWinPara.Width = ConvertToInternal(type.WindowWidth, windowFamilyParams.unitsContext);
                    slidingDoubleWinPara.Inset = ConvertToInternal(type.WindowInset, windowFamilyParams.unitsContext);
                    slidingDoubleWinPara.SillHeight = ConvertToInternal(type.WindowSillHeight, windowFamilyParams.unitsContext);
                    slidingDoubleWinPara.Type = type.TypeName;
                    m_para.CurrentPara = slidingDoubleWinPara;
                    if (!m_para.WinParaTab.Contains(slidingDoubleWinPara.Type))
                    {
                        m_para.WinParaTab.Add(slidingDoubleWinPara.Type, slidingDoubleWinPara);
                    }
                    else
                    {
                        m_para.WinParaTab[slidingDoubleWinPara.Type] = slidingDoubleWinPara;
                    }
                }
                m_para.GlassMat = windowFamilyParams.GlassPaneMaterial;
                m_para.SashMat = windowFamilyParams.SashMaterial;
            }
            else
            {
                m_winCreator = new FixedWinCreation(m_para, m_commandData);
                // TBD: Collect the params of Fixed Double window
                foreach (TypeDAParams type in windowFamilyParams.Types)
                {
                    FixedWinPara fixedWinPara = new FixedWinPara(m_para.Validator.IsMetric);
                    fixedWinPara.Height = ConvertToInternal(type.WindowHeight, windowFamilyParams.unitsContext);
                    fixedWinPara.Width = ConvertToInternal(type.WindowWidth, windowFamilyParams.unitsContext);
                    fixedWinPara.Inset = ConvertToInternal(type.WindowInset, windowFamilyParams.unitsContext);
                    fixedWinPara.SillHeight = ConvertToInternal(type.WindowSillHeight, windowFamilyParams.unitsContext);
                    fixedWinPara.Type = type.TypeName;
                    m_para.CurrentPara = fixedWinPara;
                    if (!m_para.WinParaTab.Contains(fixedWinPara.Type))
                    {
                        m_para.WinParaTab.Add(fixedWinPara.Type, fixedWinPara);
                    }
                    else
                    {
                        m_para.WinParaTab[fixedWinPara.Type] = fixedWinPara;
                    }
                }
                m_para.GlassMat = windowFamilyParams.GlassPaneMaterial;
                m_para.SashMat = windowFamilyParams.SashMaterial;
            }
            return Creation();
        }

        private static double ConvertToInternal(double value, WindowsDAParams.UnitsContext units)
        {
            // Revit internal is feet; if payload states feet (default), pass through
            if (units == null || string.IsNullOrEmpty(units.lengthUnit)) return value;
            var u = units.lengthUnit.ToLower();
            switch (u)
            {
                case "ft":
                case "feet":
                case "foot":
                    return value;
                case "in":
                case "inch":
                case "inches":
                    return UnitUtils.ConvertToInternalUnits(value, UnitTypeId.Inches);
                case "mm":
                    return UnitUtils.ConvertToInternalUnits(value, UnitTypeId.Millimeters);
                case "cm":
                    return UnitUtils.ConvertToInternalUnits(value, UnitTypeId.Centimeters);
                case "m":
                case "meter":
                case "metre":
                    return UnitUtils.ConvertToInternalUnits(value, UnitTypeId.Meters);
                default:
                    return value;
            }
        }

        /// <summary>
        /// The window creation process
        /// </summary>
        /// <returns>the result</returns>
        private bool Creation()
        {
            return m_winCreator.Creation();
        }

    }
}
